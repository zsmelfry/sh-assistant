import { sql, and, gte, lte } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smActivities } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const year = Number(query.year) || new Date().getFullYear();

  const db = useDB();

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const rows = await db
    .select({
      date: smActivities.date,
      count: sql<number>`count(*)`,
    })
    .from(smActivities)
    .where(and(
      gte(smActivities.date, startDate),
      lte(smActivities.date, endDate),
    ))
    .groupBy(smActivities.date);

  // Convert to { [date]: count } map
  const heatmap: Record<string, number> = {};
  for (const row of rows) {
    heatmap[row.date] = row.count;
  }

  return heatmap;
});
