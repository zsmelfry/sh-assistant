import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的文章 ID' });
  }

  const db = useDB();

  const existing = await db.select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '文章不存在' });
  }

  // cascade 自动删除关联的 translations, bookmarks, chats, tag_map
  await db.delete(articles).where(eq(articles.id, id));

  return { success: true };
});
