import { and, eq, gte, lte } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { checkins } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const habitId = query.habitId as string;
  const year = Number(query.year) || new Date().getFullYear();

  if (!habitId) {
    throw createError({ statusCode: 400, message: '缺少必填参数: habitId' });
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const db = useDB(event);
  const rows = await db.select({ date: checkins.date })
    .from(checkins)
    .where(
      and(
        eq(checkins.habitId, habitId),
        gte(checkins.date, startDate),
        lte(checkins.date, endDate),
      ),
    )
    .orderBy(checkins.date);

  return { dates: rows.map(r => r.date) };
});
