import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { checkins, habits } from '~/server/database/schema';
import {
  formatDate, getWeekStart, hasCheckinInWeek, hasCheckinInMonth, weekOverlapsMonth,
} from '~/server/utils/date';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const habitId = query.habitId as string;

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

  const allCheckins = await db.select({ date: checkins.date })
    .from(checkins)
    .where(eq(checkins.habitId, habitId))
    .orderBy(checkins.date);

  const allDates = allCheckins.map(c => c.date);
  const dateSet = new Set(allDates);

  const streak = calculateStreak(habit.frequency, dateSet);
  const monthlyRate = calculateMonthlyRate(habit.frequency, dateSet);

  return { streak, monthlyRate, allDates };
});

function calculateStreak(frequency: string, dates: Set<string>): number {
  if (dates.size === 0) return 0;

  const today = new Date();

  if (frequency === 'daily') {
    let streak = 0;
    const current = new Date(today);

    if (!dates.has(formatDate(current))) {
      current.setDate(current.getDate() - 1);
    }

    while (dates.has(formatDate(current))) {
      streak++;
      current.setDate(current.getDate() - 1);
    }
    return streak;
  }

  if (frequency === 'weekly') {
    let streak = 0;
    const currentWeekStart = getWeekStart(today);

    if (!hasCheckinInWeek(currentWeekStart, dates)) {
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    }

    while (hasCheckinInWeek(currentWeekStart, dates)) {
      streak++;
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    }
    return streak;
  }

  if (frequency === 'monthly') {
    let streak = 0;
    let year = today.getFullYear();
    let month = today.getMonth();

    if (!hasCheckinInMonth(year, month, dates)) {
      month--;
      if (month < 0) { month = 11; year--; }
    }

    while (hasCheckinInMonth(year, month, dates)) {
      streak++;
      month--;
      if (month < 0) { month = 11; year--; }
    }
    return streak;
  }

  return 0;
}

function calculateMonthlyRate(frequency: string, dates: Set<string>): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (frequency === 'daily') {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();
    const totalDays = Math.min(daysInMonth, today);
    let completed = 0;

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dates.has(dateStr)) completed++;
    }

    return totalDays > 0 ? Math.round((completed / totalDays) * 100) : 0;
  }

  if (frequency === 'weekly') {
    // B1 修复：使用 weekOverlapsMonth 判断周是否与目标月有交集
    const weekStart = getWeekStart(new Date(year, month, 1));
    let totalWeeks = 0;
    let completedWeeks = 0;
    const current = new Date(weekStart);

    // 遍历所有与目标月有交集的周（最多 6 周）
    for (let i = 0; i < 6; i++) {
      if (!weekOverlapsMonth(current, year, month)) break;
      if (current <= now) {
        totalWeeks++;
        if (hasCheckinInWeek(new Date(current), dates)) completedWeeks++;
      }
      current.setDate(current.getDate() + 7);
    }

    return totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;
  }

  if (frequency === 'monthly') {
    return hasCheckinInMonth(year, month, dates) ? 100 : 0;
  }

  return 0;
}
