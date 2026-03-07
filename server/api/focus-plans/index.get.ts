import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { focusPlans, skills } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const db = useDB();

  const status = (query.status as string) || 'active';

  const rows = await db
    .select({
      id: focusPlans.id,
      skillId: focusPlans.skillId,
      skillName: skills.name,
      skillCurrentTier: skills.currentTier,
      currentTier: focusPlans.currentTier,
      targetTier: focusPlans.targetTier,
      targetDate: focusPlans.targetDate,
      strategy: focusPlans.strategy,
      linkedHabitIds: focusPlans.linkedHabitIds,
      linkedPlannerGoalIds: focusPlans.linkedPlannerGoalIds,
      linkedSkillLearningIds: focusPlans.linkedSkillLearningIds,
      status: focusPlans.status,
      createdAt: focusPlans.createdAt,
      updatedAt: focusPlans.updatedAt,
    })
    .from(focusPlans)
    .leftJoin(skills, eq(skills.id, focusPlans.skillId))
    .where(eq(focusPlans.status, status));

  return rows;
});
