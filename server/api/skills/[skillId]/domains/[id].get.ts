import { eq, asc, inArray } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smDomains, smTopics, smPoints } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { skillId } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '领域');

  const [domain] = await db.select()
    .from(smDomains)
    .where(eq(smDomains.id, id))
    .limit(1);

  if (!domain || domain.skillId !== skillId) {
    throw createError({ statusCode: 404, message: '领域不存在' });
  }

  const topics = await db.select()
    .from(smTopics)
    .where(eq(smTopics.domainId, id))
    .orderBy(asc(smTopics.sortOrder));

  const topicIds = topics.map(t => t.id);
  const allPoints = topicIds.length > 0
    ? await db.select()
        .from(smPoints)
        .where(inArray(smPoints.topicId, topicIds))
        .orderBy(asc(smPoints.sortOrder))
    : [];

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
