import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  plannerGoals, plannerCheckitems, plannerGoalTags, plannerTags,
} from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

const STAGNANT_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '目标');
  const db = useDB();

  const [goal] = await db.select().from(plannerGoals).where(eq(plannerGoals.id, id)).limit(1);
  if (!goal) {
    throw createError({ statusCode: 404, message: '目标不存在' });
  }

  const checkitems = await db
    .select()
    .from(plannerCheckitems)
    .where(eq(plannerCheckitems.goalId, id))
    .orderBy(plannerCheckitems.sortOrder);

  const goalTags = await db
    .select({ id: plannerTags.id, name: plannerTags.name })
    .from(plannerGoalTags)
    .innerJoin(plannerTags, eq(plannerGoalTags.tagId, plannerTags.id))
    .where(eq(plannerGoalTags.goalId, id));

  const totalCheckitems = checkitems.length;
  const completedCheckitems = checkitems.filter((c) => c.isCompleted).length;

  let isStagnant = false;
  if (totalCheckitems > 0 && completedCheckitems < totalCheckitems) {
    const fourteenDaysAgo = Date.now() - STAGNANT_THRESHOLD_MS;
    const latestActivity = Math.max(
      ...checkitems.map((c) => c.completedAt ?? c.createdAt),
    );
    isStagnant = latestActivity < fourteenDaysAgo;
  }

  return {
    ...goal,
    tags: goalTags,
    checkitems,
    totalCheckitems,
    completedCheckitems,
    isStagnant,
  };
});
