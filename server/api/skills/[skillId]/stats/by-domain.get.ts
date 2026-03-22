import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smDomains, smTopics, smPoints } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { skillId } = await resolveSkill(db, event);

  const rows = await db
    .select({
      id: smDomains.id,
      name: smDomains.name,
      sortOrder: smDomains.sortOrder,
      total: sql<number>`count(distinct ${smPoints.id})`,
      notStarted: sql<number>`count(distinct case when ${smPoints.status} = 'not_started' then ${smPoints.id} end)`,
      learning: sql<number>`count(distinct case when ${smPoints.status} = 'learning' then ${smPoints.id} end)`,
      understood: sql<number>`count(distinct case when ${smPoints.status} = 'understood' then ${smPoints.id} end)`,
      practiced: sql<number>`count(distinct case when ${smPoints.status} = 'practiced' then ${smPoints.id} end)`,
    })
    .from(smDomains)
    .leftJoin(smTopics, sql`${smTopics.domainId} = ${smDomains.id}`)
    .leftJoin(smPoints, sql`${smPoints.topicId} = ${smTopics.id}`)
    .where(eq(smDomains.skillId, skillId))
    .groupBy(smDomains.id)
    .orderBy(smDomains.sortOrder);

  return {
    domains: rows.map(r => ({
      ...r,
      rate: r.total > 0
        ? Math.round(((r.understood + r.practiced) / r.total) * 100)
        : 0,
    })),
  };
});
