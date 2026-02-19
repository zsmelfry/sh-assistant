import { sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  plannerDomains, plannerGoals, plannerCheckitems,
} from '~/server/database/schema';

const STAGNANT_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

export default defineEventHandler(async () => {
  const db = useDB();

  // Domain-level stats
  const domainRows = await db
    .select({
      id: plannerDomains.id,
      name: plannerDomains.name,
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
    .groupBy(plannerDomains.id)
    .orderBy(plannerDomains.sortOrder);

  const domains = domainRows.map((r) => ({
    ...r,
    completionRate: r.totalCheckitems > 0
      ? Math.round((r.completedCheckitems / r.totalCheckitems) * 100)
      : 0,
  }));

  const totalGoals = domains.reduce((sum, d) => sum + d.goalCount, 0);
  const totalCheckitems = domains.reduce((sum, d) => sum + d.totalCheckitems, 0);
  const completedCheckitems = domains.reduce((sum, d) => sum + d.completedCheckitems, 0);

  // Stagnant goal detection
  const fourteenDaysAgo = Date.now() - STAGNANT_THRESHOLD_MS;
  const stagnantRows = await db
    .select({
      goalId: plannerCheckitems.goalId,
      total: sql<number>`count(*)`,
      completed: sql<number>`sum(case when ${plannerCheckitems.isCompleted} = 1 then 1 else 0 end)`,
      latestActivity: sql<number>`max(coalesce(${plannerCheckitems.completedAt}, ${plannerCheckitems.createdAt}))`,
    })
    .from(plannerCheckitems)
    .groupBy(plannerCheckitems.goalId);

  const stagnantGoalCount = stagnantRows.filter(
    (r) => r.total > 0 && r.completed < r.total && r.latestActivity < fourteenDaysAgo,
  ).length;

  return {
    totalGoals,
    totalCheckitems,
    completedCheckitems,
    globalCompletionRate: totalCheckitems > 0
      ? Math.round((completedCheckitems / totalCheckitems) * 100)
      : 0,
    stagnantGoalCount,
    domains,
  };
});
