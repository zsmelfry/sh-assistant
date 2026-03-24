import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptMilestones } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const mid = requireNumericParam(event, 'mid', '里程碑');
  const body = await readBody(event);
  const db = useDB(event);

  await requireEntity(db, ptMilestones, mid, '里程碑');

  const updates: Record<string, any> = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw createError({ statusCode: 400, message: '里程碑名称不能为空' });
    updates.title = title;
  }
  if (body.dueDate !== undefined) {
    updates.dueDate = body.dueDate || null;
  }
  if (body.reminderAt !== undefined) {
    updates.reminderAt = body.reminderAt || null;
  }

  await db.update(ptMilestones).set(updates).where(eq(ptMilestones.id, mid));

  const [updated] = await db.select().from(ptMilestones).where(eq(ptMilestones.id, mid)).limit(1);
  return updated;
});
