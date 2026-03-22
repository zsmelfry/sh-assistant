import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  plannerTags, plannerGoalTags, plannerGoals,
  plannerCheckitems, plannerDomains,
} from '~/server/database/schema';
import { completionRate, aggregateCheckitemCounts } from '~/server/utils/planner-stats';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const year = Number(query.year) || new Date().getFullYear();

  const db = useDB(event);

  const tags = await db.select().from(plannerTags).orderBy(plannerTags.name);
  if (tags.length === 0) return [];

  return Promise.all(tags.map(async (tag) => {
    const goalRows = await db
      .select({
        goalId: plannerGoals.id,
        goalTitle: plannerGoals.title,
        domainName: plannerDomains.name,
        totalCheckitems: sql<number>`count(distinct ${plannerCheckitems.id})`,
        completedCheckitems: sql<number>`count(distinct case when ${plannerCheckitems.isCompleted} = 1 then ${plannerCheckitems.id} end)`,
      })
      .from(plannerGoalTags)
      .innerJoin(plannerGoals, eq(plannerGoalTags.goalId, plannerGoals.id))
      .innerJoin(plannerDomains, eq(plannerGoals.domainId, plannerDomains.id))
      .leftJoin(plannerCheckitems, eq(plannerCheckitems.goalId, plannerGoals.id))
      .where(sql`${plannerGoalTags.tagId} = ${tag.id} and ${plannerDomains.year} = ${year}`)
      .groupBy(plannerGoals.id);

    const goals = goalRows.map((r) => ({
      id: r.goalId,
      title: r.goalTitle,
      domainName: r.domainName,
      completionRate: completionRate(r.completedCheckitems, r.totalCheckitems),
    }));

    const totals = aggregateCheckitemCounts(goalRows);

    return {
      id: tag.id,
      name: tag.name,
      goalCount: goals.length,
      ...totals,
      completionRate: completionRate(totals.completedCheckitems, totals.totalCheckitems),
      goals,
    };
  }));
});
