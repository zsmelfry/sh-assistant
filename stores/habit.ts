import { defineStore } from 'pinia';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  subDays,
  subWeeks,
  subMonths,
  getISOWeek,
  getYear,
  isSameISOWeek,
  isSameMonth,
} from 'date-fns';
import type { Habit, CheckIn, HabitFrequency, YearMonth } from '~/types';

export const useHabitStore = defineStore('habit', () => {
  // ===== 状态 =====
  const habits = ref<Habit[]>([]);
  const selectedHabitId = ref<string | null>(null);
  const currentMonth = ref<YearMonth>(getCurrentMonth());
  const checkIns = ref<CheckIn[]>([]);
  const allCheckInDates = ref<Set<string>>(new Set());

  // ===== 计算属性 =====
  const selectedHabit = computed(() =>
    habits.value.find(h => h.id === selectedHabitId.value),
  );

  const selectedFrequency = computed<HabitFrequency>(() =>
    selectedHabit.value?.frequency ?? 'daily',
  );

  const streak = computed(() =>
    calculateStreak(selectedFrequency.value, allCheckInDates.value),
  );

  const monthlyRate = computed(() =>
    calculateMonthlyRate(
      selectedFrequency.value,
      currentMonth.value,
      allCheckInDates.value,
    ),
  );

  // ===== 动作 =====
  async function loadHabits() {
    habits.value = await $fetch<Habit[]>('/api/habits');
  }

  async function selectHabit(id: string) {
    selectedHabitId.value = id;
    await Promise.all([loadCheckIns(), loadAllDates()]);
  }

  async function loadCheckIns() {
    if (!selectedHabitId.value) return;
    checkIns.value = await $fetch<CheckIn[]>('/api/checkins', {
      params: {
        habitId: selectedHabitId.value,
        month: currentMonth.value,
        frequency: selectedFrequency.value,
      },
    });
  }

  async function setMonth(month: YearMonth) {
    currentMonth.value = month;
    await loadCheckIns();
  }

  async function createHabit(name: string, frequency: HabitFrequency = 'daily') {
    const habit = await $fetch<Habit>('/api/habits', {
      method: 'POST',
      body: { name, frequency },
    });
    await loadHabits();
    await selectHabit(habit.id);
  }

  async function updateHabit(id: string, data: { name?: string; frequency?: HabitFrequency }) {
    await $fetch<Habit>(`/api/habits/${id}`, {
      method: 'PUT',
      body: data,
    });
    await loadHabits();
    if (id === selectedHabitId.value) {
      await Promise.all([loadCheckIns(), loadAllDates()]);
    }
  }

  async function deleteHabit(id: string) {
    await $fetch(`/api/habits/${id}`, { method: 'DELETE' });
    await loadHabits();
    if (id === selectedHabitId.value) {
      selectedHabitId.value = habits.value[0]?.id ?? null;
      if (selectedHabitId.value) {
        await selectHabit(selectedHabitId.value);
      } else {
        checkIns.value = [];
        allCheckInDates.value = new Set();
      }
    }
  }

  async function toggleCheckIn(date: string) {
    if (!selectedHabitId.value) return;

    // 乐观更新：先更新 UI
    const wasCheckedIn = checkIns.value.some(c => c.date === date);
    if (wasCheckedIn) {
      checkIns.value = checkIns.value.filter(c => c.date !== date);
      allCheckInDates.value.delete(date);
    } else {
      const optimistic: CheckIn = {
        id: 'temp-' + Date.now(),
        habitId: selectedHabitId.value,
        date,
        createdAt: Date.now(),
      };
      checkIns.value = [...checkIns.value, optimistic];
      allCheckInDates.value.add(date);
    }

    try {
      await $fetch('/api/checkins/toggle', {
        method: 'POST',
        body: { habitId: selectedHabitId.value, date },
      });
      // 成功后重新加载确保数据一致
      await loadCheckIns();
      await loadAllDates();
    } catch {
      // 失败回滚：重新加载服务端数据
      await loadCheckIns();
      await loadAllDates();
    }
  }

  async function loadAllDates() {
    if (!selectedHabitId.value) return;
    const stats = await $fetch<{ allDates: string[] }>('/api/checkins/stats', {
      params: { habitId: selectedHabitId.value },
    });
    allCheckInDates.value = new Set(stats.allDates);
  }

  return {
    // 状态
    habits, selectedHabitId, currentMonth, checkIns,
    allCheckInDates,
    // 计算属性
    selectedHabit, selectedFrequency, streak, monthlyRate,
    // 动作
    loadHabits, selectHabit, setMonth,
    createHabit, updateHabit, deleteHabit, toggleCheckIn,
  };
});

// ===== 辅助函数 =====

function getCurrentMonth(): YearMonth {
  return format(new Date(), 'yyyy-MM');
}

function calculateStreak(freq: HabitFrequency, dates: Set<string>): number {
  if (dates.size === 0) return 0;

  const today = new Date();

  if (freq === 'daily') {
    let streak = 0;
    let current = today;
    // 如果今天没打卡，从昨天开始算
    if (!dates.has(format(current, 'yyyy-MM-dd'))) {
      current = subDays(current, 1);
    }
    while (dates.has(format(current, 'yyyy-MM-dd'))) {
      streak++;
      current = subDays(current, 1);
    }
    return streak;
  }

  if (freq === 'weekly') {
    let streak = 0;
    let currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

    // 检查本周是否有打卡
    const thisWeekHasCheckin = hasCheckinInWeek(currentWeekStart, dates);
    if (!thisWeekHasCheckin) {
      currentWeekStart = subWeeks(currentWeekStart, 1);
    }

    while (hasCheckinInWeek(currentWeekStart, dates)) {
      streak++;
      currentWeekStart = subWeeks(currentWeekStart, 1);
    }
    return streak;
  }

  if (freq === 'monthly') {
    let streak = 0;
    let currentMonthStart = startOfMonth(today);

    // 检查本月是否有打卡
    const thisMonthHasCheckin = hasCheckinInMonth(currentMonthStart, dates);
    if (!thisMonthHasCheckin) {
      currentMonthStart = subMonths(currentMonthStart, 1);
    }

    while (hasCheckinInMonth(currentMonthStart, dates)) {
      streak++;
      currentMonthStart = subMonths(currentMonthStart, 1);
    }
    return streak;
  }

  return 0;
}

function hasCheckinInWeek(weekStart: Date, dates: Set<string>): boolean {
  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  });
  return days.some(d => dates.has(format(d, 'yyyy-MM-dd')));
}

function hasCheckinInMonth(monthStart: Date, dates: Set<string>): boolean {
  const days = eachDayOfInterval({
    start: monthStart,
    end: endOfMonth(monthStart),
  });
  return days.some(d => dates.has(format(d, 'yyyy-MM-dd')));
}

function calculateMonthlyRate(
  freq: HabitFrequency,
  month: YearMonth,
  dates: Set<string>,
): number {
  const [yearStr, monthStr] = month.split('-');
  const monthStart = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  const monthEnd = endOfMonth(monthStart);
  const today = new Date();
  const effectiveEnd = monthEnd > today ? today : monthEnd;

  if (effectiveEnd < monthStart) return 0;

  if (freq === 'daily') {
    const daysInRange = eachDayOfInterval({ start: monthStart, end: effectiveEnd });
    const checkedDays = daysInRange.filter(d => dates.has(format(d, 'yyyy-MM-dd')));
    return daysInRange.length > 0
      ? Math.round((checkedDays.length / daysInRange.length) * 100)
      : 0;
  }

  if (freq === 'weekly') {
    // 计算本月包含的周数和已完成周数
    const weeks = new Set<string>();
    const completedWeeks = new Set<string>();
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: effectiveEnd });

    for (const day of daysInMonth) {
      const weekKey = `${getYear(startOfWeek(day, { weekStartsOn: 1 }))}-W${getISOWeek(day)}`;
      weeks.add(weekKey);
      if (dates.has(format(day, 'yyyy-MM-dd'))) {
        completedWeeks.add(weekKey);
      }
    }

    return weeks.size > 0
      ? Math.round((completedWeeks.size / weeks.size) * 100)
      : 0;
  }

  if (freq === 'monthly') {
    // 月频率：本月有任何打卡即为完成
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const hasCheckin = daysInMonth.some(d => dates.has(format(d, 'yyyy-MM-dd')));
    return hasCheckin ? 100 : 0;
  }

  return 0;
}
