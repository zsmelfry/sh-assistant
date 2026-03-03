import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptProjects, ptCategories, PT_STATUSES, PT_PRIORITIES } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '事项');
  const body = await readBody(event);
  const db = useDB();

  await requireEntity(db, ptProjects, id, '事项');

  const updates: Record<string, any> = { updatedAt: Date.now() };

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw createError({ statusCode: 400, message: '标题不能为空' });
    updates.title = title;
  }

  if (body.description !== undefined) {
    updates.description = body.description || null;
  }

  if (body.status !== undefined) {
    if (!PT_STATUSES.includes(body.status)) {
      throw createError({ statusCode: 400, message: '无效的状态' });
    }
    updates.status = body.status;
    // Auto-archive on done/dropped
    if (['done', 'dropped'].includes(body.status)) {
      updates.archived = true;
    }
  }

  if (body.categoryId !== undefined) {
    await requireEntity(db, ptCategories, Number(body.categoryId), '分类');
    updates.categoryId = Number(body.categoryId);
  }

  if (body.dueDate !== undefined) {
    updates.dueDate = body.dueDate || null;
  }

  if (body.priority !== undefined) {
    if (!PT_PRIORITIES.includes(body.priority)) {
      throw createError({ statusCode: 400, message: '无效的优先级' });
    }
    updates.priority = body.priority;
  }

  if (body.blockedReason !== undefined) {
    updates.blockedReason = body.blockedReason || null;
  }

  if (body.reminderAt !== undefined) {
    updates.reminderAt = body.reminderAt || null;
  }

  await db.update(ptProjects).set(updates).where(eq(ptProjects.id, id));

  const [updated] = await db.select().from(ptProjects).where(eq(ptProjects.id, id)).limit(1);
  return updated;
});
