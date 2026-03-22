import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerCheckitems, plannerGoals, skills } from '~/server/database/schema';
import { logActivity } from '~/server/lib/ability/log-activity';

export default defineEventHandler(async (event) => {
  const { id } = await readBody(event);

  if (!id || typeof id !== 'number') {
    throw createError({ statusCode: 400, message: '缺少检查项 ID' });
  }

  const db = useDB();

  const [existing] = await db.select().from(plannerCheckitems).where(eq(plannerCheckitems.id, id)).limit(1);
  if (!existing) {
    throw createError({ statusCode: 404, message: '检查项不存在' });
  }

  const now = Date.now();
  const newCompleted = !existing.isCompleted;

  await db.update(plannerCheckitems).set({
    isCompleted: newCompleted,
    completedAt: newCompleted ? now : null,
    updatedAt: now,
  }).where(eq(plannerCheckitems.id, id));

  // Log activity when completing a checkitem
  if (newCompleted) {
    const activityParams: Parameters<typeof logActivity>[1] = {
      source: 'planner',
      sourceRef: `checkitem:${id}`,
      description: `完成检查项：${existing.content}`,
    };

    // Look up linked ability skill via goal
    const [goal] = await db.select({ linkedAbilitySkillId: plannerGoals.linkedAbilitySkillId })
      .from(plannerGoals).where(eq(plannerGoals.id, existing.goalId)).limit(1);

    if (goal?.linkedAbilitySkillId) {
      const [skill] = await db.select({ id: skills.id, categoryId: skills.categoryId })
        .from(skills).where(eq(skills.id, goal.linkedAbilitySkillId)).limit(1);
      if (skill) {
        activityParams.skillId = skill.id;
        activityParams.categoryId = skill.categoryId;
      }
    }

    logActivity(db, activityParams).catch(() => {});
  }

  return {
    id,
    isCompleted: newCompleted,
    completedAt: newCompleted ? now : null,
  };
});
