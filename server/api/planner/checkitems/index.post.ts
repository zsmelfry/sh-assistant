import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerCheckitems, plannerGoals } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.goalId || typeof body.goalId !== 'number') {
    throw createError({ statusCode: 400, message: '缺少 goalId' });
  }
  if (!body.content?.trim()) {
    throw createError({ statusCode: 400, message: '检查项内容不能为空' });
  }

  const db = useDB();

  // Verify goal exists
  const goal = await db.select().from(plannerGoals).where(eq(plannerGoals.id, body.goalId)).limit(1);
  if (goal.length === 0) {
    throw createError({ statusCode: 404, message: '目标不存在' });
  }

  // Get max sortOrder within goal
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${plannerCheckitems.sortOrder}), -1)` })
    .from(plannerCheckitems)
    .where(eq(plannerCheckitems.goalId, body.goalId));

  const now = Date.now();
  const [inserted] = await db.insert(plannerCheckitems).values({
    goalId: body.goalId,
    content: body.content.trim(),
    isCompleted: false,
    sortOrder: maxRow.max + 1,
    createdAt: now,
    updatedAt: now,
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
