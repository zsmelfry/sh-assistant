import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  plannerDomains, plannerGoals, plannerCheckitems,
  plannerTags, plannerGoalTags,
} from '~/server/database/schema';
import { completionRate, aggregateCheckitemCounts } from '~/server/utils/planner-stats';

export default defineEventHandler(async () => {
  const db = useDB();

  const domains = await db.select().from(plannerDomains).orderBy(plannerDomains.sortOrder);
  if (domains.length === 0) return [];

  // Batch fetch all goal-tag associations
  const allGoalTags = await db
    .select({ goalId: plannerGoalTags.goalId, tagName: plannerTags.name })
    .from(plannerGoalTags)
    .innerJoin(plannerTags, eq(plannerGoalTags.tagId, plannerTags.id));

  const tagsByGoalId = new Map<number, string[]>();
  for (const row of allGoalTags) {
    const list = tagsByGoalId.get(row.goalId) ?? [];
    list.push(row.tagName);
    tagsByGoalId.set(row.goalId, list);
  }

  return Promise.all(domains.map(async (domain) => {
    const goalRows = await db
      .select({
        goalId: plannerGoals.id,
        goalTitle: plannerGoals.title,
        totalCheckitems: sql<number>`count(distinct ${plannerCheckitems.id})`,
        completedCheckitems: sql<number>`count(distinct case when ${plannerCheckitems.isCompleted} = 1 then ${plannerCheckitems.id} end)`,
      })
      .from(plannerGoals)
      .leftJoin(plannerCheckitems, eq(plannerCheckitems.goalId, plannerGoals.id))
      .where(eq(plannerGoals.domainId, domain.id))
      .groupBy(plannerGoals.id)
      .orderBy(plannerGoals.sortOrder);

    const goals = goalRows.map((r) => ({
      id: r.goalId,
      title: r.goalTitle,
      tagNames: (tagsByGoalId.get(r.goalId) ?? []).join('、'),
      completionRate: completionRate(r.completedCheckitems, r.totalCheckitems),
    }));

    const totals = aggregateCheckitemCounts(goalRows);

    return {
      id: domain.id,
      name: domain.name,
      goalCount: goals.length,
      ...totals,
      completionRate: completionRate(totals.completedCheckitems, totals.totalCheckitems),
      goals,
    };
  }));
});
