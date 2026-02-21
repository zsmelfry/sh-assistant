<template>
  <div class="heatmapGrid">
    <!-- Year nav -->
    <div class="yearNav">
      <button class="navBtn" @click="emit('change-year', year - 1)">&lt;</button>
      <span class="yearLabel">{{ year }}</span>
      <button class="navBtn" @click="emit('change-year', year + 1)">&gt;</button>
    </div>

    <!-- Weekday labels + daily grid -->
    <div class="gridWrapper">
      <div class="weekdayLabels">
        <span v-for="label in ['', '一', '', '三', '', '五', '']" :key="label">
          {{ label }}
        </span>
      </div>
      <div class="dailyGrid">
        <div
          v-for="day in gridDays"
          :key="day.date"
          class="cell"
          :class="cellClass(day)"
          @mouseenter="showTooltip(day, $event)"
          @mouseleave="hideTooltip"
          @click="emit('select-date', day.date)"
        />
      </div>
    </div>

    <!-- Legend -->
    <div class="legend">
      <span class="legendLabel">少</span>
      <div class="cell legendCell empty" />
      <div class="cell legendCell level1" />
      <div class="cell legendCell level2" />
      <div class="cell legendCell level3" />
      <span class="legendLabel">多</span>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        {{ tooltip.text }}
      </div>
    </Teleport>
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
  isSameYear,
} from 'date-fns';

const props = defineProps<{
  year: number;
  data: Record<string, number>;
}>();

const emit = defineEmits<{
  'change-year': [year: number];
  'select-date': [date: string];
}>();

interface GridDay {
  date: string;
  inYear: boolean;
  count: number;
}

const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  text: '',
});

const gridDays = computed<GridDay[]>(() => {
  const yearStart = startOfYear(new Date(props.year, 0, 1));
  const yearEnd = endOfYear(yearStart);

  const gridStart = startOfWeek(yearStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(yearEnd, { weekStartsOn: 1 });

  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return allDays.map(d => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const inYear = isSameYear(d, yearStart);
    const count = inYear ? (props.data[dateStr] || 0) : 0;
    return { date: dateStr, inYear, count };
  });
});

function cellClass(day: GridDay) {
  if (!day.inYear) return 'outside';
  if (day.count === 0) return 'empty';
  if (day.count <= 2) return 'level1';
  if (day.count <= 5) return 'level2';
  return 'level3';
}

function showTooltip(day: GridDay, event: MouseEvent) {
  if (!day.inYear) return;
  tooltip.visible = true;
  tooltip.x = event.clientX;
  tooltip.y = event.clientY;
  tooltip.text = day.count > 0
    ? `${day.date}  ${day.count} 次学习行为`
    : `${day.date}  无学习行为`;
}

function hideTooltip() {
  tooltip.visible = false;
}
</script>

<style scoped>
.heatmapGrid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  overflow-x: auto;
}

.yearNav {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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

.gridWrapper {
  display: flex;
}

.weekdayLabels {
  display: grid;
  grid-template-rows: repeat(7, var(--chart-cell-size));
  gap: var(--chart-cell-gap);
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

.cell {
  width: var(--chart-cell-size);
  height: var(--chart-cell-size);
  border-radius: 2px;
  cursor: default;
}

.cell.outside {
  background-color: var(--color-chart-bg);
}

.cell.empty {
  background-color: var(--color-chart-empty);
}

/* Four grey levels: lighter → darker */
.cell.level1 {
  background-color: var(--color-border);
}

.cell.level2 {
  background-color: var(--color-text-secondary);
}

.cell.level3 {
  background-color: var(--color-text-primary);
}

/* Legend */
.legend {
  display: flex;
  align-items: center;
  gap: var(--chart-cell-gap);
  align-self: flex-end;
}

.legendLabel {
  font-size: 10px;
  color: var(--color-text-secondary);
}

.legendCell {
  cursor: default;
}

/* Tooltip */
.tooltip {
  position: fixed;
  background: var(--color-text-primary);
  color: var(--color-accent-inverse);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 1000;
  transform: translate(-50%, -100%);
  margin-top: -8px;
}

@media (max-width: 768px) {
  .navBtn {
    width: var(--touch-target-min);
    height: var(--touch-target-min);
    font-size: 14px;
  }
}
</style>
