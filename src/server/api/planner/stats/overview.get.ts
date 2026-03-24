import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  plannerDomains, plannerGoals, plannerCheckitems,
} from '~/server/database/schema';
import { completionRate, aggregateCheckitemCounts } from '~/server/utils/planner-stats';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const year = Number(query.year) || new Date().getFullYear();

  const db = useDB(event);

  // Domain-level stats
  const domainRows = await db
    .select({
      id: plannerDomains.id,
      name: plannerDomains.name,
      year: plannerDomains.year,
      sortOrder: plannerDomains.sortOrder,
      createdAt: plannerDomains.createdAt,
      updatedAt: plannerDomains.updatedAt,
      goalCount: sql<number>`count(distinct ${plannerGoals.id})`,
      totalCheckitems: sql<number>`count(distinct ${plannerCheckitems.id})`,
      completedCheckitems: sql<number>`count(distinct case when ${plannerCheckitems.isCompleted} = 1 then ${plannerCheckitems.id} end)`,
    })
    .from(plannerDomains)
    .leftJoin(plannerGoals, sql`${plannerGoals.domainId} = ${plannerDomains.id}`)
    .leftJoin(plannerCheckitems, sql`${plannerCheckitems.goalId} = ${plannerGoals.id}`)
    .where(eq(plannerDomains.year, year))
    .groupBy(plannerDomains.id)
    .orderBy(plannerDomains.sortOrder);

  const domains = domainRows.map((r) => ({
    ...r,
    completionRate: completionRate(r.completedCheckitems, r.totalCheckitems),
  }));

  const totalGoals = domains.reduce((sum, d) => sum + d.goalCount, 0);
  const totals = aggregateCheckitemCounts(domains);

  return {
    totalGoals,
    ...totals,
    globalCompletionRate: completionRate(totals.completedCheckitems, totals.totalCheckitems),
    domains,
  };
});
