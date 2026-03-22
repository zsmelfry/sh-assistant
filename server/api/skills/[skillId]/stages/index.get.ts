import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smStages, smStagePoints, smPoints } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId } = await resolveSkill(db, event);

  const rows = await db
    .select({
      id: smStages.id,
      name: smStages.name,
      description: smStages.description,
      objective: smStages.objective,
      sortOrder: smStages.sortOrder,
      pointCount: sql<number>`count(distinct ${smStagePoints.pointId})`,
      completedCount: sql<number>`count(distinct case when ${smPoints.status} in ('understood', 'practiced') then ${smStagePoints.pointId} end)`,
    })
    .from(smStages)
    .leftJoin(smStagePoints, sql`${smStagePoints.stageId} = ${smStages.id}`)
    .leftJoin(smPoints, sql`${smPoints.id} = ${smStagePoints.pointId}`)
    .where(eq(smStages.skillId, skillId))
    .groupBy(smStages.id)
    .orderBy(smStages.sortOrder);

  let currentFound = false;
  return rows.map((r) => {
    const isCompleted = r.pointCount > 0 && r.completedCount >= r.pointCount;
    const isCurrent = !currentFound && !isCompleted;
    if (isCurrent) currentFound = true;

    return {
      ...r,
      completionRate: r.pointCount > 0
        ? Math.round((r.completedCount / r.pointCount) * 100)
        : 0,
      isCompleted,
      isCurrent,
    };
  });
});
