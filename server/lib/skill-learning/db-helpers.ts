import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { smPoints, smTopics, smDomains } from '~/server/database/schema';
import { useDB } from '~/server/database';
import { requireSkill } from './registry';
import type { SkillConfig } from './types';
import { ensureSkillsRegistered } from './init';

/** Extract skillId from route param and validate skill exists */
export async function resolveSkill(event: H3Event): Promise<{ skillId: string; config: SkillConfig }> {
  await ensureSkillsRegistered();
  const skillId = getRouterParam(event, 'skillId');
  if (!skillId) {
    throw createError({ statusCode: 400, message: '缺少 skillId' });
  }
  const config = requireSkill(skillId);
  return { skillId, config };
}

/** Verify a knowledge point belongs to the specified skill via point → topic → domain.skillId chain */
export async function requirePointForSkill(
  db: ReturnType<typeof useDB>,
  pointId: number,
  skillId: string,
): Promise<{ point: typeof smPoints.$inferSelect; topic: typeof smTopics.$inferSelect; domain: typeof smDomains.$inferSelect }> {
  const [point] = await db.select().from(smPoints).where(eq(smPoints.id, pointId)).limit(1);
  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  const [topic] = await db.select().from(smTopics).where(eq(smTopics.id, point.topicId)).limit(1);
  const [domain] = topic
    ? await db.select().from(smDomains).where(eq(smDomains.id, topic.domainId)).limit(1)
    : [undefined];

  if (!topic || !domain) {
    throw createError({ statusCode: 500, message: '数据不完整' });
  }

  if (domain.skillId !== skillId) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  return { point, topic, domain };
}
