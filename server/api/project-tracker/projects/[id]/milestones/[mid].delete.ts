import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptMilestones, ptChecklistItems } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const mid = requireNumericParam(event, 'mid', '里程碑');
  const db = useDB();

  await requireEntity(db, ptMilestones, mid, '里程碑');

  // Move checklist items to ungrouped (set milestoneId to null)
  await db.update(ptChecklistItems)
    .set({ milestoneId: null })
    .where(eq(ptChecklistItems.milestoneId, mid));

  await db.delete(ptMilestones).where(eq(ptMilestones.id, mid));

  return { success: true };
});
