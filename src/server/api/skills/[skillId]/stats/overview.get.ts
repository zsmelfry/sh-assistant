import { eq, sql, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smDomains, smTopics, smPoints, smStages, smStagePoints } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId } = await resolveSkill(db, event);

  const [row] = await db
    .select({
      totalPoints: sql<number>`count(distinct ${smPoints.id})`,
      notStarted: sql<number>`count(distinct case when ${smPoints.status} = 'not_started' then ${smPoints.id} end)`,
      learning: sql<number>`count(distinct case when ${smPoints.status} = 'learning' then ${smPoints.id} end)`,
      understood: sql<number>`count(distinct case when ${smPoints.status} = 'understood' then ${smPoints.id} end)`,
      practiced: sql<number>`count(distinct case when ${smPoints.status} = 'practiced' then ${smPoints.id} end)`,
    })
    .from(smDomains)
    .leftJoin(smTopics, sql`${smTopics.domainId} = ${smDomains.id}`)
    .leftJoin(smPoints, sql`${smPoints.topicId} = ${smTopics.id}`)
    .where(eq(smDomains.skillId, skillId));

  const totalPoints = row?.totalPoints ?? 0;
  const completedCount = (row?.understood ?? 0) + (row?.practiced ?? 0);

  const stages = await db
    .select({
      id: smStages.id,
      pointCount: sql<number>`count(distinct ${smStagePoints.pointId})`,
      completedCount: sql<number>`count(distinct case when ${smPoints.status} in ('understood', 'practiced') then ${smStagePoints.pointId} end)`,
    })
    .from(smStages)
    .leftJoin(smStagePoints, sql`${smStagePoints.stageId} = ${smStages.id}`)
    .leftJoin(smPoints, sql`${smPoints.id} = ${smStagePoints.pointId}`)
    .where(eq(smStages.skillId, skillId))
    .groupBy(smStages.id)
    .orderBy(asc(smStages.sortOrder));

  const currentStage = stages.find(s => s.pointCount > 0 && s.completedCount < s.pointCount);

  return {
    totalPoints,
    completedCount,
    completionRate: totalPoints > 0 ? Math.round((completedCount / totalPoints) * 100) : 0,
    notStarted: row?.notStarted ?? 0,
    learning: row?.learning ?? 0,
    understood: row?.understood ?? 0,
    practiced: row?.practiced ?? 0,
    currentStageId: currentStage?.id ?? null,
  };
});
