import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointArticles, smPoints, smTopics, smDomains } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const articleId = Number(getRouterParam(event, 'articleId'));
  if (!articleId || isNaN(articleId)) {
    throw createError({ statusCode: 400, message: '无效的文章 ID' });
  }

  const db = useDB();

  return db
    .select({
      pointId: smPoints.id,
      pointName: smPoints.name,
      status: smPoints.status,
      topicName: smTopics.name,
      domainName: smDomains.name,
      linkedAt: smPointArticles.createdAt,
    })
    .from(smPointArticles)
    .innerJoin(smPoints, sql`${smPoints.id} = ${smPointArticles.pointId}`)
    .innerJoin(smTopics, sql`${smTopics.id} = ${smPoints.topicId}`)
    .innerJoin(smDomains, sql`${smDomains.id} = ${smTopics.domainId}`)
    .where(eq(smPointArticles.articleId, articleId));
});
