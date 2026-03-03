import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptProjects, ptCategories } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();

  // Status distribution
  const statusStats = await db
    .select({
      status: ptProjects.status,
      count: sql<number>`count(*)`,
    })
    .from(ptProjects)
    .groupBy(ptProjects.status);

  // Category distribution
  const categoryStats = await db
    .select({
      categoryId: ptProjects.categoryId,
      categoryName: ptCategories.name,
      count: sql<number>`count(*)`,
    })
    .from(ptProjects)
    .leftJoin(ptCategories, eq(ptProjects.categoryId, ptCategories.id))
    .groupBy(ptProjects.categoryId);

  // Total counts
  const [totals] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${ptProjects.status} in ('todo', 'in_progress', 'blocked') then 1 else 0 end)`,
      archived: sql<number>`sum(case when ${ptProjects.archived} = 1 then 1 else 0 end)`,
    })
    .from(ptProjects);

  return {
    total: totals.total ?? 0,
    active: totals.active ?? 0,
    archived: totals.archived ?? 0,
    byStatus: statusStats,
    byCategory: categoryStats,
  };
});
