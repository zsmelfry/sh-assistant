import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptChecklistItems, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireNonEmpty, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const projectId = requireNumericParam(event, 'id', '事项');
  const body = await readBody(event);
  const content = requireNonEmpty(body.content, '任务内容');
  const db = useDB(event);

  await requireEntity(db, ptProjects, projectId, '事项');

  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${ptChecklistItems.sortOrder}), -1)` })
    .from(ptChecklistItems)
    .where(eq(ptChecklistItems.projectId, projectId));

  const priority = body.priority || 'medium';
  if (!['low', 'medium', 'high'].includes(priority)) {
    throw createError({ statusCode: 400, message: '优先级必须是 low、medium 或 high' });
  }

  const [inserted] = await db.insert(ptChecklistItems).values({
    projectId,
    content,
    description: body.description || null,
    priority,
    milestoneId: body.milestoneId ? Number(body.milestoneId) : null,
    dueDate: body.dueDate || null,
    sortOrder: maxRow.max + 1,
    createdAt: Date.now(),
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
