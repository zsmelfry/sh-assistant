import { eq, sql, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smStages, smStagePoints, smPoints, smTopics, smDomains } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的阶段 ID' });
  }

  const db = useDB();

  // Fetch stage
  const [stage] = await db.select()
    .from(smStages)
    .where(eq(smStages.id, id))
    .limit(1);

  if (!stage) {
    throw createError({ statusCode: 404, message: '阶段不存在' });
  }

  // Fetch associated points with domain/topic info
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
