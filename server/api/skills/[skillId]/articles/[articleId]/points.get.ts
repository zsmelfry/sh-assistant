import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointArticles, smPoints, smTopics, smDomains } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const articleId = requireNumericParam(event, 'articleId', '文章');
  const db = useDB();

  // JOIN domain to verify skillId — prevents cross-skill data leakage
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
    .where(sql`${smPointArticles.articleId} = ${articleId} AND ${smDomains.skillId} = ${skillId}`);
});
