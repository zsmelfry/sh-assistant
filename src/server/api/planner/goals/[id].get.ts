import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  plannerGoals, plannerCheckitems, plannerGoalTags, plannerTags,
} from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '目标');
  const db = useDB(event);

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

  return {
    ...goal,
    tags: goalTags,
    checkitems,
    totalCheckitems,
    completedCheckitems,
  };
});
