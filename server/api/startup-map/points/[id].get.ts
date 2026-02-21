import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints, smTopics, smDomains, smTeachings } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的知识点 ID' });
  }

  const db = useDB();

  // Fetch point
  const [point] = await db.select()
    .from(smPoints)
    .where(eq(smPoints.id, id))
    .limit(1);

  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  // Fetch topic and domain for breadcrumb
  const [topic] = await db.select()
    .from(smTopics)
    .where(eq(smTopics.id, point.topicId))
    .limit(1);

  const [domain] = topic
    ? await db.select()
        .from(smDomains)
        .where(eq(smDomains.id, topic.domainId))
        .limit(1)
    : [null];

  // Fetch teaching content
  const [teaching] = await db.select()
    .from(smTeachings)
    .where(eq(smTeachings.pointId, id))
    .limit(1);

  return {
    ...point,
    teaching: teaching || null,
    topic: topic ? { id: topic.id, name: topic.name } : null,
    domain: domain ? { id: domain.id, name: domain.name } : null,
  };
});
