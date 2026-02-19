import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  plannerGoals, plannerCheckitems, plannerGoalTags, plannerTags,
} from '~/server/database/schema';

const STAGNANT_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const domainId = Number(query.domainId);

  if (!domainId || isNaN(domainId)) {
    throw createError({ statusCode: 400, message: '缺少 domainId 参数' });
  }

  const db = useDB();

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

  const fourteenDaysAgo = Date.now() - STAGNANT_THRESHOLD_MS;

  return goals.map((goal) => {
    const checkitems = allCheckitems.filter((c) => c.goalId === goal.id);
    const tags = allGoalTags
      .filter((t) => t.goalId === goal.id)
      .map((t) => ({ id: t.tagId, name: t.tagName }));

    const totalCheckitems = checkitems.length;
    const completedCheckitems = checkitems.filter((c) => c.isCompleted).length;

    // Stagnant: has checkitems, not all completed, and no recent activity
    let isStagnant = false;
    if (totalCheckitems > 0 && completedCheckitems < totalCheckitems) {
      const latestActivity = Math.max(
        ...checkitems.map((c) => c.completedAt ?? c.createdAt),
      );
      isStagnant = latestActivity < fourteenDaysAgo;
    }

    return {
      ...goal,
      tags,
      checkitems,
      totalCheckitems,
      completedCheckitems,
      isStagnant,
    };
  });
});
