import { eq, asc, inArray } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smDomains, smTopics, smPoints } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的领域 ID' });
  }

  const db = useDB();

  // Fetch domain
  const [domain] = await db.select()
    .from(smDomains)
    .where(eq(smDomains.id, id))
    .limit(1);

  if (!domain) {
    throw createError({ statusCode: 404, message: '领域不存在' });
  }

  // Fetch topics
  const topics = await db.select()
    .from(smTopics)
    .where(eq(smTopics.domainId, id))
    .orderBy(asc(smTopics.sortOrder));

  // Fetch all points for these topics in one query
  const topicIds = topics.map(t => t.id);
  const allPoints = topicIds.length > 0
    ? await db.select()
        .from(smPoints)
        .where(inArray(smPoints.topicId, topicIds))
        .orderBy(asc(smPoints.sortOrder))
    : [];

  // Group points by topic
  const pointsByTopic = new Map<number, typeof allPoints>();
  for (const point of allPoints) {
    const group = pointsByTopic.get(point.topicId) || [];
    group.push(point);
    pointsByTopic.set(point.topicId, group);
  }

  return {
    ...domain,
    topics: topics.map(topic => ({
      ...topic,
      points: pointsByTopic.get(topic.id) || [],
    })),
  };
});
