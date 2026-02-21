import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointArticles, smPoints, smTopics, smDomains } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const articleId = requireNumericParam(event, 'articleId', '文章');

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
