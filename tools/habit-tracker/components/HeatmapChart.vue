<template>
  <div class="heatmap">
    <div class="yearNav">
      <button class="navBtn" @click="year--">&lt;</button>
      <span class="yearLabel">{{ year }}</span>
      <button class="navBtn" @click="year++">&gt;</button>
    </div>

    <!-- Daily: 7行 × 53列 -->
    <template v-if="frequency === 'daily'">
      <div class="weekdayLabels">
        <span v-for="label in ['', '一', '', '三', '', '五', '']" :key="label">
          {{ label }}
        </span>
      </div>
      <div class="dailyGrid">
        <div
          v-for="day in dailyGridDays"
          :key="day.date"
          class="cell"
          :class="{ filled: day.checked, outside: !day.inYear }"
          @mouseenter="showTooltip(day.tooltipText, $event)"
          @mouseleave="hideTooltip"
        />
      </div>
    </template>

    <!-- Weekly: 1行 × 52列 -->
    <template v-else-if="frequency === 'weekly'">
      <div class="weeklyGrid">
        <div
          v-for="week in weeklyGridWeeks"
          :key="week.weekNum"
          class="cell cellLarge"
          :class="{ filled: week.completed }"
          @mouseenter="showTooltip(week.tooltipText, $event)"
          @mouseleave="hideTooltip"
        />
      </div>
      <div class="weeklyLabels">
        <span v-for="i in [1, 13, 26, 39, 52]" :key="i">{{ i }}</span>
      </div>
    </template>

    <!-- Monthly: 1行 × 12列 -->
    <template v-else-if="frequency === 'monthly'">
      <div class="monthlyGrid">
        <div
          v-for="m in monthlyGridMonths"
          :key="m.month"
          class="cell cellLarge"
          :class="{ filled: m.completed }"
          @mouseenter="showTooltip(m.tooltipText, $event)"
          @mouseleave="hideTooltip"
        />
      </div>
      <div class="monthlyLabels">
        <span v-for="i in 12" :key="i">{{ i }}</span>
      </div>
    </template>

    <ChartTooltip
      :visible="tooltip.visible"
      :x="tooltip.x"
      :y="tooltip.y"
      :text="tooltip.text"
    />
  </div>
</template>

<script setup lang="ts">
import {
  format,
  startOfYear,
  endOfYear,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  getISOWeek,
  isSameYear,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import type { HabitFrequency, HeatmapResponse } from '../types';
import ChartTooltip from './ChartTooltip.vue';

const props = defineProps<{
  habitId: string;
  frequency: HabitFrequency;
}>();

const year = ref(new Date().getFullYear());

const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  text: '',
});

// Fetch heatmap data
const heatmapDates = ref<Set<string>>(new Set());

async function loadData() {
  if (!props.habitId) return;
  const data = await $fetch<HeatmapResponse>('/api/checkins/heatmap', {
    params: { habitId: props.habitId, year: year.value },
  });
  heatmapDates.value = new Set(data.dates);
}

watch([() => props.habitId, year], loadData, { immediate: true });

// Daily grid: column-first layout (7 rows × ~53 cols)
const dailyGridDays = computed(() => {
  const yearStart = startOfYear(new Date(year.value, 0, 1));
  const yearEnd = endOfYear(yearStart);

  // Grid starts on the Monday of the week containing Jan 1
  const gridStart = startOfWeek(yearStart, { weekStartsOn: 1 });
  // Grid ends on the Sunday of the week containing Dec 31
  const gridEnd = endOfWeek(yearEnd, { weekStartsOn: 1 });

  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return allDays.map(d => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const inYear = isSameYear(d, yearStart);
    const checked = heatmapDates.value.has(dateStr);
    return {
      date: dateStr,
      inYear,
      checked: inYear && checked,
      tooltipText: `${dateStr} ${checked ? '已打卡' : '未打卡'}`,
    };
  });
});

// Weekly grid: 52 weeks
const weeklyGridWeeks = computed(() => {
  const yearStart = new Date(year.value, 0, 1);
  const yearEnd = new Date(year.value, 11, 31);
  const weeks = eachWeekOfInterval(
    { start: yearStart, end: yearEnd },
    { weekStartsOn: 1 },
  );

  return weeks.slice(0, 52).map((weekStart, i) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const completed = weekDays.some(d => heatmapDates.value.has(format(d, 'yyyy-MM-dd')));
    const startStr = format(weekStart, 'M/d');
    const endStr = format(weekEnd, 'M/d');
    return {
      weekNum: i + 1,
      completed,
      tooltipText: `第${i + 1}周 (${startStr}-${endStr}) ${completed ? '已完成' : '未完成'}`,
    };
  });
});

// Monthly grid: 12 months
const monthlyGridMonths = computed(() => {
  return Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(year.value, i, 1);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const completed = days.some(d => heatmapDates.value.has(format(d, 'yyyy-MM-dd')));
    return {
      month: i + 1,
      completed,
      tooltipText: `${i + 1}月 ${completed ? '已完成' : '未完成'}`,
    };
  });
});

function showTooltip(text: string, event: MouseEvent) {
  tooltip.visible = true;
  tooltip.x = event.clientX;
  tooltip.y = event.clientY;
  tooltip.text = text;
}

function hideTooltip() {
  tooltip.visible = false;
}
</script>

<style scoped>
.heatmap {
  overflow-x: auto;
}

.yearNav {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.navBtn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  width: 22px;
  height: 22px;
  cursor: pointer;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.navBtn:hover {
  background-color: var(--color-bg-hover);
}

.yearLabel {
  font-size: 12px;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
}

.weekdayLabels {
  display: grid;
  grid-template-rows: repeat(7, var(--chart-cell-size));
  gap: var(--chart-cell-gap);
  float: left;
  margin-right: var(--spacing-xs);
}

.weekdayLabels span {
  font-size: 9px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: var(--chart-cell-size);
}

.dailyGrid {
  display: grid;
  grid-template-rows: repeat(7, var(--chart-cell-size));
  grid-auto-flow: column;
  grid-auto-columns: var(--chart-cell-size);
  gap: var(--chart-cell-gap);
  overflow-x: auto;
}

.weeklyGrid {
  display: grid;
  grid-template-columns: repeat(52, var(--chart-cell-size));
  gap: var(--chart-cell-gap);
  overflow-x: auto;
}

.monthlyGrid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--chart-cell-gap);
  max-width: 300px;
}

.weeklyLabels,
.monthlyLabels {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  font-size: 9px;
  color: var(--color-text-secondary);
}

.weeklyLabels {
  max-width: calc(52 * (var(--chart-cell-size) + var(--chart-cell-gap)));
}

.cell {
  width: var(--chart-cell-size);
  height: var(--chart-cell-size);
  border-radius: 2px;
  background-color: var(--color-chart-empty);
  cursor: default;
}

.cell.filled {
  background-color: var(--color-chart-fill);
}

.cell.outside {
  background-color: var(--color-chart-bg);
}

.cellLarge {
  width: auto;
  height: 14px;
}
</style>
