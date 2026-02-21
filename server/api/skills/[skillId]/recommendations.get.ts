import { sql, eq, asc, and, notInArray } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smStages, smStagePoints, smPoints, smTopics, smDomains } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const db = useDB();

  const stages = await db
    .select({
      id: smStages.id,
      name: smStages.name,
      sortOrder: smStages.sortOrder,
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

  if (!currentStage) {
    return { allCompleted: true, currentStage: null, recommendations: [] };
  }

  const points = await db
    .select({
      id: smPoints.id,
      name: smPoints.name,
      status: smPoints.status,
      sortOrder: smStagePoints.sortOrder,
      topicId: smTopics.id,
      topicName: smTopics.name,
      domainId: smDomains.id,
      domainName: smDomains.name,
    })
    .from(smStagePoints)
    .innerJoin(smPoints, sql`${smPoints.id} = ${smStagePoints.pointId}`)
    .innerJoin(smTopics, sql`${smTopics.id} = ${smPoints.topicId}`)
    .innerJoin(smDomains, sql`${smDomains.id} = ${smTopics.domainId}`)
    .where(and(
      eq(smStagePoints.stageId, currentStage.id),
      notInArray(smPoints.status, ['understood', 'practiced']),
    ))
    .orderBy(asc(smStagePoints.sortOrder))
    .limit(3);

  const stageInfo = { id: currentStage.id, name: currentStage.name };

  return {
    allCompleted: false,
    currentStage: stageInfo,
    recommendations: points.map(p => ({
      pointId: p.id,
      name: p.name,
      status: p.status,
      domain: { id: p.domainId, name: p.domainName },
      topic: { id: p.topicId, name: p.topicName },
      stage: stageInfo,
    })),
  };
});
