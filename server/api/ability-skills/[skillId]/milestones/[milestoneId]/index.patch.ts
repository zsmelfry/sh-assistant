import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { milestones, skills } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const skillId = requireNumericParam(event, 'skillId', '技能');
  const id = requireNumericParam(event, 'milestoneId', '里程碑');
  const body = await readBody(event);
  const db = useDB();

  const [milestone] = await db.select().from(milestones)
    .where(and(eq(milestones.id, id), eq(milestones.skillId, skillId)));
  if (!milestone) {
    throw createError({ statusCode: 404, message: '里程碑不存在' });
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.title !== undefined) {
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      throw createError({ statusCode: 400, message: '里程碑标题不能为空' });
    }
    updates.title = body.title.trim();
  }
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.tier !== undefined) {
    const tier = Number(body.tier);
    if (!tier || tier < 1 || tier > 5) {
      throw createError({ statusCode: 400, message: '段位必须在 1-5 之间' });
    }
    updates.tier = tier;
  }
  if (body.verifyConfig !== undefined) {
    updates.verifyConfig = body.verifyConfig ? JSON.stringify(body.verifyConfig) : null;
  }

  const [updated] = await db.update(milestones).set(updates)
    .where(eq(milestones.id, id)).returning();
  return updated;
});
