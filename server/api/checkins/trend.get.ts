import { and, eq, gte, lte } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { checkins, habits } from '~/server/database/schema';
import { getWeekStart, hasCheckinInWeek, weekOverlapsMonth } from '~/server/utils/date';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const habitId = query.habitId as string;
  const months = Number(query.months) || 12;

  if (!habitId) {
    throw createError({ statusCode: 400, message: '缺少必填参数: habitId' });
  }

  const db = useDB();

  const habitRows = await db.select()
    .from(habits)
    .where(eq(habits.id, habitId))
    .limit(1);

  if (habitRows.length === 0) {
    throw createError({ statusCode: 404, message: '习惯不存在' });
  }

  const habit = habitRows[0];
  const now = new Date();
  const result: Array<{ month: string; total: number; completed: number; rate: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth(); // 0-based
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const startDate = `${monthStr}-01`;
    const endDate = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

    const rows = await db.select({ date: checkins.date })
      .from(checkins)
      .where(
        and(
          eq(checkins.habitId, habitId),
          gte(checkins.date, startDate),
          lte(checkins.date, endDate),
        ),
      );

    const checkinDates = new Set(rows.map(r => r.date));

    if (habit.frequency === 'daily') {
      const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
      const total = isCurrentMonth ? now.getDate() : daysInMonth;
      const completed = checkinDates.size;
      result.push({
        month: monthStr,
        total,
        completed,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      });
    } else if (habit.frequency === 'weekly') {
      // B1 修复：使用 weekOverlapsMonth 判断周是否与目标月有交集
      const weekStart = getWeekStart(new Date(year, month, 1));
      let totalWeeks = 0;
      let completedWeeks = 0;
      const current = new Date(weekStart);

      for (let w = 0; w < 6; w++) {
        if (!weekOverlapsMonth(current, year, month)) break;
        totalWeeks++;
        if (hasCheckinInWeek(new Date(current), checkinDates)) completedWeeks++;
        current.setDate(current.getDate() + 7);
      }

      result.push({
        month: monthStr,
        total: totalWeeks,
        completed: completedWeeks,
        rate: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0,
      });
    } else {
      // monthly
      const completed = checkinDates.size > 0 ? 1 : 0;
      result.push({
        month: monthStr,
        total: 1,
        completed,
        rate: completed * 100,
      });
    }
  }

  return { months: result };
});
