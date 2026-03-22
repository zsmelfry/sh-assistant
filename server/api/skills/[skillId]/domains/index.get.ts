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
      description: smDomains.description,
      sortOrder: smDomains.sortOrder,
      createdAt: smDomains.createdAt,
      topicCount: sql<number>`count(distinct ${smTopics.id})`,
      pointCount: sql<number>`count(distinct ${smPoints.id})`,
      completedCount: sql<number>`count(distinct case when ${smPoints.status} in ('understood', 'practiced') then ${smPoints.id} end)`,
    })
    .from(smDomains)
    .leftJoin(smTopics, sql`${smTopics.domainId} = ${smDomains.id}`)
    .leftJoin(smPoints, sql`${smPoints.topicId} = ${smTopics.id}`)
    .where(eq(smDomains.skillId, skillId))
    .groupBy(smDomains.id)
    .orderBy(smDomains.sortOrder);

  return rows.map((r) => ({
    ...r,
    completionRate: r.pointCount > 0
      ? Math.round((r.completedCount / r.pointCount) * 100)
      : 0,
  }));
});
