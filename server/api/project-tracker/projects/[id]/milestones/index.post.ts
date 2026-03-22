import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptMilestones, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireNonEmpty, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const projectId = requireNumericParam(event, 'id', '事项');
  const body = await readBody(event);
  const title = requireNonEmpty(body.title, '里程碑名称');
  const db = useDB(event);

  await requireEntity(db, ptProjects, projectId, '事项');

  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${ptMilestones.sortOrder}), -1)` })
    .from(ptMilestones)
    .where(eq(ptMilestones.projectId, projectId));

  const [inserted] = await db.insert(ptMilestones).values({
    projectId,
    title,
    dueDate: body.dueDate || null,
    sortOrder: maxRow.max + 1,
    createdAt: Date.now(),
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
