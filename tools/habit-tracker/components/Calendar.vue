<template>
  <div class="calendar">
    <!-- 月度完成徽章（monthly 频率且已完成） -->
    <div v-if="frequency === 'monthly' && isMonthCompleted" class="monthBadge">
      本月已完成 ✓
    </div>

    <!-- 星期表头 -->
    <div class="weekdayHeader">
      <div v-for="wd in weekdays" :key="wd" class="weekdayLabel">
        {{ wd }}
      </div>
    </div>

    <!-- 日期网格 -->
    <div class="grid" :class="{ gridWeekly: frequency === 'weekly' }">
      <CalendarDay
        v-for="day in calendarDays"
        :key="day.date"
        :day="day"
        @toggle="$emit('toggle', $event)"
        @open-note="$emit('open-note', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday as dateIsToday,
  isFuture as dateIsFuture,
  isSameMonth,
  isSameISOWeek,
} from 'date-fns';
import type { YearMonth, HabitFrequency, CheckIn, CalendarDayData } from '../types';
import CalendarDay from './CalendarDay.vue';

const props = defineProps<{
  month: YearMonth;
  frequency: HabitFrequency;
  checkIns: CheckIn[];
  allCheckInDates: Set<string>;
}>();

defineEmits<{
  toggle: [date: string];
  'open-note': [date: string];
}>();

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

const checkedDates = computed(() =>
  new Set(props.checkIns.map(c => c.date)),
);

const notesByDate = computed(() => {
  const map = new Map<string, string>();
  for (const c of props.checkIns) {
    if (c.note) map.set(c.date, c.note);
  }
  return map;
});

const isMonthCompleted = computed(() => {
  if (props.frequency !== 'monthly') return false;
  const [yearStr, monthStr] = props.month.split('-');
  const monthStart = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  return days.some(d => checkedDates.value.has(format(d, 'yyyy-MM-dd')));
});

const calendarDays = computed((): CalendarDayData[] => {
  const [yearStr, monthStr] = props.month.split('-');
  const monthDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  // 日历起始到结束（包含前后月溢出天）
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return days.map((date): CalendarDayData => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isCurrentMonth = isSameMonth(date, monthDate);
    const isCheckedIn = checkedDates.value.has(dateStr);

    // 周期完成逻辑
    let isPeriodCompleted = false;
    if (isCurrentMonth && !isCheckedIn) {
      if (props.frequency === 'weekly') {
        // 检查同一周是否有打卡
        isPeriodCompleted = props.checkIns.some(c =>
          isSameISOWeek(new Date(c.date + 'T00:00:00'), date),
        );
      } else if (props.frequency === 'monthly') {
        // 检查同月是否有打卡
        isPeriodCompleted = isMonthCompleted.value;
      }
    }

    return {
      date: dateStr,
      dayOfMonth: date.getDate(),
      isCurrentMonth,
      isToday: dateIsToday(date),
      isFuture: dateIsFuture(date) && !dateIsToday(date),
      isCheckedIn,
      isPeriodCompleted,
      note: notesByDate.value.get(dateStr) || null,
    };
  });
});
</script>

<style scoped>
.calendar {
  max-width: 100%;
}

.monthBadge {
  text-align: center;
  padding: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
}

.weekdayHeader {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: var(--spacing-xs);
}

.weekdayLabel {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs) 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

</style>
