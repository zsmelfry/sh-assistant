import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  plannerGoals, plannerCheckitems, plannerGoalTags, plannerTags,
} from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const domainId = Number(query.domainId);

  if (!domainId || isNaN(domainId)) {
    throw createError({ statusCode: 400, message: '缺少 domainId 参数' });
  }

  const db = useDB(event);

  const goals = await db
    .select()
    .from(plannerGoals)
    .where(eq(plannerGoals.domainId, domainId))
    .orderBy(plannerGoals.sortOrder);

  if (goals.length === 0) return [];

  const goalIds = goals.map((g) => g.id);

  // Fetch all checkitems for these goals
  const allCheckitems = await db
    .select()
    .from(plannerCheckitems)
    .where(sql`${plannerCheckitems.goalId} in (${sql.join(goalIds.map((id) => sql`${id}`), sql`, `)})`)
    .orderBy(plannerCheckitems.sortOrder);

  // Fetch all tags for these goals
  const allGoalTags = await db
    .select({
      goalId: plannerGoalTags.goalId,
      tagId: plannerTags.id,
      tagName: plannerTags.name,
    })
    .from(plannerGoalTags)
    .innerJoin(plannerTags, eq(plannerGoalTags.tagId, plannerTags.id))
    .where(sql`${plannerGoalTags.goalId} in (${sql.join(goalIds.map((id) => sql`${id}`), sql`, `)})`);

  return goals.map((goal) => {
    const checkitems = allCheckitems.filter((c) => c.goalId === goal.id);
    const tags = allGoalTags
      .filter((t) => t.goalId === goal.id)
      .map((t) => ({ id: t.tagId, name: t.tagName }));

    const totalCheckitems = checkitems.length;
    const completedCheckitems = checkitems.filter((c) => c.isCompleted).length;

    return {
      ...goal,
      tags,
      checkitems,
      totalCheckitems,
      completedCheckitems,
    };
  });
});
