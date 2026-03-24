import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerDomains, plannerGoals, plannerCheckitems } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const year = Number(query.year) || new Date().getFullYear();

  const db = useDB(event);

  const rows = await db
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

  return rows.map((r) => ({
    ...r,
    completionRate: r.totalCheckitems > 0
      ? Math.round((r.completedCheckitems / r.totalCheckitems) * 100)
      : 0,
  }));
});
