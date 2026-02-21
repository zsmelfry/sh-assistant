import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointArticles } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const articleId = Number(getRouterParam(event, 'articleId'));
  const pointId = Number(getRouterParam(event, 'pointId'));

  if (!articleId || isNaN(articleId) || !pointId || isNaN(pointId)) {
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
