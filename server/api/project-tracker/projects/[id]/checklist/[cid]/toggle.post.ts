import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptChecklistItems } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const cid = requireNumericParam(event, 'cid', '任务');
  const db = useDB();

  const item = await requireEntity<{ id: number; isCompleted: boolean }>(db, ptChecklistItems, cid, '任务');

  const isCompleted = !item.isCompleted;
  await db.update(ptChecklistItems).set({
    isCompleted,
    completedAt: isCompleted ? Date.now() : null,
  }).where(eq(ptChecklistItems.id, cid));

  const [updated] = await db.select().from(ptChecklistItems).where(eq(ptChecklistItems.id, cid)).limit(1);
  return updated;
});
