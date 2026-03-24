import { eq, sql, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smStages, smStagePoints, smPoints, smTopics, smDomains } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '阶段');

  const [stage] = await db.select()
    .from(smStages)
    .where(eq(smStages.id, id))
    .limit(1);

  if (!stage || stage.skillId !== skillId) {
    throw createError({ statusCode: 404, message: '阶段不存在' });
  }

  const points = await db
    .select({
      id: smPoints.id,
      name: smPoints.name,
      description: smPoints.description,
      status: smPoints.status,
      statusUpdatedAt: smPoints.statusUpdatedAt,
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
    .where(eq(smStagePoints.stageId, id))
    .orderBy(asc(smStagePoints.sortOrder));

  const completedCount = points.filter(p =>
    p.status === 'understood' || p.status === 'practiced'
  ).length;

  return {
    ...stage,
    pointCount: points.length,
    completedCount,
    completionRate: points.length > 0
      ? Math.round((completedCount / points.length) * 100)
      : 0,
    points: points.map(p => ({
      pointId: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      statusUpdatedAt: p.statusUpdatedAt,
      sortOrder: p.sortOrder,
      domain: { id: p.domainId, name: p.domainName },
      topic: { id: p.topicId, name: p.topicName },
    })),
  };
});
