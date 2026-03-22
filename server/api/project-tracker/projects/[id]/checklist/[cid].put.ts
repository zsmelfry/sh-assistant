import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptChecklistItems } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const cid = requireNumericParam(event, 'cid', '任务');
  const body = await readBody(event);
  const db = useDB(event);

  await requireEntity(db, ptChecklistItems, cid, '任务');

  const updates: Record<string, any> = {};

  if (body.content !== undefined) {
    const content = String(body.content).trim();
    if (!content) throw createError({ statusCode: 400, message: '任务内容不能为空' });
    updates.content = content;
  }
  if (body.milestoneId !== undefined) {
    updates.milestoneId = body.milestoneId || null;
  }
  if (body.description !== undefined) {
    updates.description = body.description || null;
  }
  if (body.priority !== undefined) {
    if (!['low', 'medium', 'high'].includes(body.priority)) {
      throw createError({ statusCode: 400, message: '优先级必须是 low、medium 或 high' });
    }
    updates.priority = body.priority;
  }
  if (body.dueDate !== undefined) {
    updates.dueDate = body.dueDate || null;
  }
  if (body.linkedNoteId !== undefined) {
    updates.linkedNoteId = body.linkedNoteId || null;
  }
  if (body.linkedDiagramId !== undefined) {
    updates.linkedDiagramId = body.linkedDiagramId || null;
  }
  if (body.reminderAt !== undefined) {
    updates.reminderAt = body.reminderAt || null;
  }

  await db.update(ptChecklistItems).set(updates).where(eq(ptChecklistItems.id, cid));

  const [updated] = await db.select().from(ptChecklistItems).where(eq(ptChecklistItems.id, cid)).limit(1);
  return updated;
});
