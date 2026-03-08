import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'skillId', '技能');
  const body = await readBody(event);
  const db = useDB();

  await requireEntity(db, skills, id, '技能');

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      throw createError({ statusCode: 400, message: '技能名称不能为空' });
    }
    updates.name = body.name.trim();
  }
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.icon !== undefined) updates.icon = body.icon || null;
  if (body.status !== undefined) {
    if (!['active', 'paused'].includes(body.status)) {
      throw createError({ statusCode: 400, message: '无效的状态' });
    }
    updates.status = body.status;
  }

  const [updated] = await db.update(skills).set(updates).where(eq(skills.id, id)).returning();
  return updated;
});
