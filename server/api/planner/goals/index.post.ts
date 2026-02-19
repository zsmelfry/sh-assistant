import { eq, sql, inArray } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerGoals, plannerGoalTags, plannerDomains, plannerTags } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.domainId || typeof body.domainId !== 'number') {
    throw createError({ statusCode: 400, message: '缺少 domainId' });
  }
  if (!body.title?.trim()) {
    throw createError({ statusCode: 400, message: '目标标题不能为空' });
  }

  const validPriorities = ['high', 'medium', 'low'];
  const priority = body.priority || 'medium';
  if (!validPriorities.includes(priority)) {
    throw createError({ statusCode: 400, message: '无效的优先级' });
  }

  const db = useDB();

  // Verify domain exists
  const domain = await db.select().from(plannerDomains).where(eq(plannerDomains.id, body.domainId)).limit(1);
  if (domain.length === 0) {
    throw createError({ statusCode: 404, message: '领域不存在' });
  }

  // Validate tagIds if provided
  const tagIds: number[] = body.tagIds ?? [];
  if (tagIds.length > 0) {
    const existingTags = await db.select({ id: plannerTags.id }).from(plannerTags)
      .where(inArray(plannerTags.id, tagIds));
    if (existingTags.length !== tagIds.length) {
      throw createError({ statusCode: 400, message: '部分标签不存在' });
    }
  }

  // Get max sortOrder within domain
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${plannerGoals.sortOrder}), -1)` })
    .from(plannerGoals)
    .where(eq(plannerGoals.domainId, body.domainId));

  const now = Date.now();
  const [inserted] = await db.insert(plannerGoals).values({
    domainId: body.domainId,
    title: body.title.trim(),
    description: body.description?.trim() ?? '',
    priority: priority as 'high' | 'medium' | 'low',
    sortOrder: maxRow.max + 1,
    createdAt: now,
    updatedAt: now,
  }).returning();

  // Associate tags if provided
  if (tagIds.length > 0) {
    await db.insert(plannerGoalTags).values(
      tagIds.map((tagId: number) => ({ goalId: inserted.id, tagId })),
    );
  }

  setResponseStatus(event, 201);
  return inserted;
});
