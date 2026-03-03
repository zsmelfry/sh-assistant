import { eq, isNull, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptChecklistItems, ptMilestones, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const projectId = requireNumericParam(event, 'id', '事项');
  const db = useDB();
  await requireEntity(db, ptProjects, projectId, '事项');

  // Get milestones
  const milestones = await db.select().from(ptMilestones)
    .where(eq(ptMilestones.projectId, projectId))
    .orderBy(ptMilestones.sortOrder);

  // Get all checklist items
  const items = await db.select().from(ptChecklistItems)
    .where(eq(ptChecklistItems.projectId, projectId))
    .orderBy(ptChecklistItems.sortOrder);

  // Group by milestone
  const groups = milestones.map(m => ({
    ...m,
    items: items.filter(i => i.milestoneId === m.id),
    total: items.filter(i => i.milestoneId === m.id).length,
    done: items.filter(i => i.milestoneId === m.id && i.isCompleted).length,
  }));

  // Ungrouped items
  const ungrouped = items.filter(i => i.milestoneId === null);
  if (ungrouped.length > 0) {
    groups.push({
      id: 0,
      projectId,
      title: '未分组',
      dueDate: null,
      sortOrder: 999999,
      createdAt: 0,
      items: ungrouped,
      total: ungrouped.length,
      done: ungrouped.filter(i => i.isCompleted).length,
    });
  }

  return groups;
});
