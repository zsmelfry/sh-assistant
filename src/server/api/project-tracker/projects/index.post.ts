import { sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptProjects, ptCategories, PT_STATUSES, PT_PRIORITIES } from '~/server/database/schema';
import { requireNonEmpty, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const title = requireNonEmpty(body.title, '事项标题');
  const db = useDB(event);

  // Validate category
  if (!body.categoryId) {
    throw createError({ statusCode: 400, message: '分类不能为空' });
  }
  await requireEntity(db, ptCategories, Number(body.categoryId), '分类');

  // Validate optional fields
  const status = body.status || 'idea';
  if (!PT_STATUSES.includes(status)) {
    throw createError({ statusCode: 400, message: '无效的状态' });
  }

  const priority = body.priority || 'medium';
  if (!PT_PRIORITIES.includes(priority)) {
    throw createError({ statusCode: 400, message: '无效的优先级' });
  }

  // Get max sort order
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${ptProjects.sortOrder}), -1)` })
    .from(ptProjects);

  const now = Date.now();
  const [inserted] = await db.insert(ptProjects).values({
    title,
    description: body.description || null,
    status,
    categoryId: Number(body.categoryId),
    dueDate: body.dueDate || null,
    priority,
    sortOrder: maxRow.max + 1,
    createdAt: now,
    updatedAt: now,
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
