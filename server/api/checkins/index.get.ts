import { and, eq, gte, lte } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { checkins } from '~/server/database/schema';
import { formatDate, getCurrentMonth, isValidMonth } from '~/server/utils/date';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const habitId = query.habitId as string;

  if (!habitId) {
    throw createError({ statusCode: 400, message: '缺少必填参数: habitId' });
  }

  const month = (query.month as string) || getCurrentMonth();
  const frequency = query.frequency as string;

  // M3: 校验 month 格式
  if (!isValidMonth(month)) {
    throw createError({ statusCode: 400, message: '月份格式无效，应为 YYYY-MM' });
  }

  const { startDate, endDate } = getDateRange(month, frequency);

  const db = useDB();
  return db.select()
    .from(checkins)
    .where(
      and(
        eq(checkins.habitId, habitId),
        gte(checkins.date, startDate),
        lte(checkins.date, endDate),
      ),
    )
    .orderBy(checkins.date);
});

function getDateRange(month: string, frequency?: string): { startDate: string; endDate: string } {
  const [year, mon] = month.split('-').map(Number);

  let startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  let endDate = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // weekly 频率：扩展到完整自然周
  if (frequency === 'weekly') {
    const firstDayOfMonth = new Date(year, mon - 1, 1);
    const lastDayOfMonth = new Date(year, mon - 1, lastDay);

    const startDow = firstDayOfMonth.getDay();
    const daysToMonday = startDow === 0 ? 6 : startDow - 1;
    const expandedStart = new Date(firstDayOfMonth);
    expandedStart.setDate(expandedStart.getDate() - daysToMonday);
    startDate = formatDate(expandedStart);

    const endDow = lastDayOfMonth.getDay();
    const daysToSunday = endDow === 0 ? 0 : 7 - endDow;
    const expandedEnd = new Date(lastDayOfMonth);
    expandedEnd.setDate(expandedEnd.getDate() + daysToSunday);
    endDate = formatDate(expandedEnd);
  }

  return { startDate, endDate };
}
