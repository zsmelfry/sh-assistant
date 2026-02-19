import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  plannerTags, plannerGoalTags, plannerGoals,
  plannerCheckitems, plannerDomains,
} from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();

  // Get all tags
  const tags = await db.select().from(plannerTags).orderBy(plannerTags.name);

  if (tags.length === 0) return [];

  // For each tag, get associated goals with their checkitem stats
  const result = await Promise.all(tags.map(async (tag) => {
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
      .where(eq(plannerGoalTags.tagId, tag.id))
      .groupBy(plannerGoals.id);

    const goals = goalRows.map((r) => ({
      id: r.goalId,
      title: r.goalTitle,
      domainName: r.domainName,
      completionRate: r.totalCheckitems > 0
        ? Math.round((r.completedCheckitems / r.totalCheckitems) * 100)
        : 0,
    }));

    const totalCheckitems = goalRows.reduce((s, r) => s + r.totalCheckitems, 0);
    const completedCheckitems = goalRows.reduce((s, r) => s + r.completedCheckitems, 0);

    return {
      id: tag.id,
      name: tag.name,
      goalCount: goals.length,
      totalCheckitems,
      completedCheckitems,
      completionRate: totalCheckitems > 0
        ? Math.round((completedCheckitems / totalCheckitems) * 100)
        : 0,
      goals,
    };
  }));

  return result;
});
