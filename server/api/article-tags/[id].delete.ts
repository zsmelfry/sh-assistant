import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articleTags } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的标签 ID' });
  }

  const db = useDB();

  const existing = await db.select({ id: articleTags.id })
    .from(articleTags)
    .where(eq(articleTags.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '标签不存在' });
  }

  // Delete tag — article_tag_map entries cascade automatically
  await db.delete(articleTags).where(eq(articleTags.id, id));

  return { success: true };
});
