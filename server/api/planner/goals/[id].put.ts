import { eq, inArray } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerGoals, plannerGoalTags, plannerTags, VALID_PRIORITIES } from '~/server/database/schemas/planner';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '目标');
  const body = await readBody(event);
  const db = useDB();
  await requireEntity(db, plannerGoals, id, '目标');

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.title !== undefined) {
    if (!body.title?.trim()) {
      throw createError({ statusCode: 400, message: '目标标题不能为空' });
    }
    updates.title = body.title.trim();
  }

  if (body.description !== undefined) {
    updates.description = body.description?.trim() ?? '';
  }

  if (body.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(body.priority)) {
      throw createError({ statusCode: 400, message: '无效的优先级' });
    }
    updates.priority = body.priority;
  }

  if (body.linkedAbilitySkillId !== undefined) {
    updates.linkedAbilitySkillId = body.linkedAbilitySkillId;
  }

  // Validate tagIds if provided
  if (body.tagIds !== undefined) {
    const tagIds: number[] = body.tagIds ?? [];
    if (tagIds.length > 0) {
      const existingTags = await db.select({ id: plannerTags.id }).from(plannerTags)
        .where(inArray(plannerTags.id, tagIds));
      if (existingTags.length !== tagIds.length) {
        throw createError({ statusCode: 400, message: '部分标签不存在' });
      }
    }
  }

  // Use transaction to ensure goal update + tag replacement are atomic
  db.transaction((tx) => {
    tx.update(plannerGoals).set(updates).where(eq(plannerGoals.id, id)).run();

    if (body.tagIds !== undefined) {
      const tagIds: number[] = body.tagIds ?? [];
      tx.delete(plannerGoalTags).where(eq(plannerGoalTags.goalId, id)).run();
      if (tagIds.length > 0) {
        tx.insert(plannerGoalTags).values(
          tagIds.map((tagId: number) => ({ goalId: id, tagId })),
        ).run();
      }
    }
  });

  const [updated] = await db.select().from(plannerGoals).where(eq(plannerGoals.id, id)).limit(1);
  return updated;
});
