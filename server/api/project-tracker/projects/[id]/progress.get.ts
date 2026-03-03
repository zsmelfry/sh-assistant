import { eq, sql, isNull } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptProjects, ptMilestones, ptChecklistItems } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '事项');
  const db = useDB();

  await requireEntity(db, ptProjects, id, '事项');

  // Get milestones with their checklist stats
  const milestones = await db
    .select({
      id: ptMilestones.id,
      title: ptMilestones.title,
    })
    .from(ptMilestones)
    .where(eq(ptMilestones.projectId, id))
    .orderBy(ptMilestones.sortOrder);

  const result: { id: number | null; title: string; total: number; done: number }[] = [];

  for (const m of milestones) {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`,
        done: sql<number>`sum(case when ${ptChecklistItems.isCompleted} = 1 then 1 else 0 end)`,
      })
      .from(ptChecklistItems)
      .where(eq(ptChecklistItems.milestoneId, m.id));

    result.push({
      id: m.id,
      title: m.title,
      total: stats.total ?? 0,
      done: stats.done ?? 0,
    });
  }

  // Ungrouped items (no milestone)
  const [ungrouped] = await db
    .select({
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${ptChecklistItems.isCompleted} = 1 then 1 else 0 end)`,
    })
    .from(ptChecklistItems)
    .where(eq(ptChecklistItems.projectId, id))
    .where(isNull(ptChecklistItems.milestoneId));

  if ((ungrouped.total ?? 0) > 0) {
    result.push({
      id: null,
      title: '未分组',
      total: ungrouped.total ?? 0,
      done: ungrouped.done ?? 0,
    });
  }

  const totalItems = result.reduce((sum, m) => sum + m.total, 0);
  const totalDone = result.reduce((sum, m) => sum + m.done, 0);

  return {
    milestones: result,
    totalItems,
    totalDone,
    percentage: totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0,
  };
});
