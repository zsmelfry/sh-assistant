import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleTags, articleTagMap } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的文章 ID' });
  }

  const body = await readBody(event);
  const { tagIds } = body || {};

  if (!Array.isArray(tagIds)) {
    throw createError({ statusCode: 400, message: 'tagIds 必须是数组' });
  }

  // Validate all tagIds are numbers
  if (tagIds.some((id: any) => typeof id !== 'number' || isNaN(id))) {
    throw createError({ statusCode: 400, message: 'tagIds 中的每个元素必须是数字' });
  }

  const db = useDB();

  // Check article existence
  const article = await db.select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (article.length === 0) {
    throw createError({ statusCode: 404, message: '文章不存在' });
  }

  // Validate all tags exist
  if (tagIds.length > 0) {
    const existingTags = await db.select({ id: articleTags.id })
      .from(articleTags)
      .where(sql`${articleTags.id} IN (${sql.join(tagIds.map((tid: number) => sql`${tid}`), sql`, `)})`);

    if (existingTags.length !== tagIds.length) {
      throw createError({ statusCode: 400, message: '部分标签不存在' });
    }
  }

  // Replace all tags in a transaction
  db.transaction((tx) => {
    // Delete existing mappings
    tx.delete(articleTagMap)
      .where(eq(articleTagMap.articleId, id))
      .run();

    // Insert new mappings
    if (tagIds.length > 0) {
      tx.insert(articleTagMap)
        .values(tagIds.map((tagId: number) => ({ articleId: id, tagId })))
        .run();
    }
  });

  // Return updated tag list for this article
  const updatedTags = tagIds.length > 0
    ? await db.select({
        id: articleTags.id,
        name: articleTags.name,
        color: articleTags.color,
        createdAt: articleTags.createdAt,
      })
        .from(articleTagMap)
        .innerJoin(articleTags, eq(articleTagMap.tagId, articleTags.id))
        .where(eq(articleTagMap.articleId, id))
    : [];

  return updatedTags;
});
