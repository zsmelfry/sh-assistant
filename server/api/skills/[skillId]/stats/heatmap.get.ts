import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smActivities } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { skillId } = await resolveSkill(db, event);
  const query = getQuery(event);
  const year = Number(query.year) || new Date().getFullYear();

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const rows = await db
    .select({
      date: smActivities.date,
      count: sql<number>`count(*)`,
    })
    .from(smActivities)
    .where(and(
      eq(smActivities.skillId, skillId),
      gte(smActivities.date, startDate),
      lte(smActivities.date, endDate),
    ))
    .groupBy(smActivities.date);

  const heatmap: Record<string, number> = {};
  for (const row of rows) {
    heatmap[row.date] = row.count;
  }

  return heatmap;
});
