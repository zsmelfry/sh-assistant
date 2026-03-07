import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { focusPlans } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '焦点计划');
  const body = await readBody(event);
  const db = useDB();

  await requireEntity(db, focusPlans, id, '焦点计划');

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.targetTier !== undefined) updates.targetTier = Number(body.targetTier);
  if (body.targetDate !== undefined) updates.targetDate = body.targetDate;
  if (body.strategy !== undefined) updates.strategy = body.strategy || null;
  if (body.status !== undefined) {
    if (!['active', 'achieved', 'abandoned'].includes(body.status)) {
      throw createError({ statusCode: 400, message: '无效的状态' });
    }
    updates.status = body.status;
  }

  const [updated] = await db.update(focusPlans).set(updates)
    .where(eq(focusPlans.id, id)).returning();
  return updated;
});
