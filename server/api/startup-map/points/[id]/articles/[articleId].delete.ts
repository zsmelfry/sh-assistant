import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointArticles } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const pointId = Number(getRouterParam(event, 'id'));
  const articleId = Number(getRouterParam(event, 'articleId'));

  if (!pointId || isNaN(pointId) || !articleId || isNaN(articleId)) {
    throw createError({ statusCode: 400, message: '无效的 ID' });
  }

  const db = useDB();

  const result = await db.delete(smPointArticles)
    .where(and(
      eq(smPointArticles.pointId, pointId),
      eq(smPointArticles.articleId, articleId),
    ))
    .returning();

  if (result.length === 0) {
    throw createError({ statusCode: 404, message: '关联不存在' });
  }

  return { success: true };
});
