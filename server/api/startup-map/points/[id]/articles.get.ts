import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointArticles, smPoints, articles, articleBookmarks } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '知识点');

  const db = useDB();

  // Verify point exists
  const [point] = await db.select({ id: smPoints.id })
    .from(smPoints)
    .where(eq(smPoints.id, id))
    .limit(1);

  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  return db
    .select({
      articleId: articles.id,
      title: articles.title,
      url: articles.url,
      siteName: articles.siteName,
      bookmarkedAt: articleBookmarks.bookmarkedAt,
      linkedAt: smPointArticles.createdAt,
    })
    .from(smPointArticles)
    .innerJoin(articles, sql`${articles.id} = ${smPointArticles.articleId}`)
    .leftJoin(articleBookmarks, sql`${articleBookmarks.articleId} = ${articles.id}`)
    .where(eq(smPointArticles.pointId, id));
});
