<template>
  <div class="heatmapGrid">
    <!-- Year nav -->
    <div class="yearNav">
      <button class="navBtn" @click="emit('change-year', year - 1)">&lt;</button>
      <span class="yearLabel">{{ year }}</span>
      <button class="navBtn" @click="emit('change-year', year + 1)">&gt;</button>
    </div>

    <!-- Month labels (vertical) + daily grid -->
    <div class="gridWrapper">
      <div class="monthLabels">
        <span v-for="m in 12" :key="m">{{ m }}月</span>
      </div>
      <div class="gridContent">
        <!-- Day-of-month header -->
        <div class="dayHeader">
          <span v-for="d in 31" :key="d">{{ d }}</span>
        </div>
        <!-- 12 rows × 31 columns -->
        <div class="dailyGrid">
          <template v-for="cell in gridCells" :key="cell.key">
            <div
              v-if="cell.exists"
              class="cell"
              :class="cellClass(cell)"
              @mouseenter="showTooltip(cell, $event)"
              @mouseleave="hideTooltip"
              @click="emit('select-date', cell.date)"
            />
            <div v-else class="cell placeholder" />
          </template>
        </div>
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
import { format, getDaysInMonth } from 'date-fns';

const props = defineProps<{
  year: number;
  data: Record<string, number>;
}>();

const emit = defineEmits<{
  'change-year': [year: number];
  'select-date': [date: string];
}>();

interface GridCell {
  key: string;
  date: string;
  exists: boolean;
  count: number;
}

const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  text: '',
});

const gridCells = computed<GridCell[]>(() => {
  const cells: GridCell[] = [];
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = getDaysInMonth(new Date(props.year, month - 1));
    for (let day = 1; day <= 31; day++) {
      const exists = day <= daysInMonth;
      const dateStr = exists
        ? format(new Date(props.year, month - 1, day), 'yyyy-MM-dd')
        : '';
      cells.push({
        key: `${month}-${day}`,
        date: dateStr,
        exists,
        count: exists ? (props.data[dateStr] || 0) : 0,
      });
    }
  }
  return cells;
});

function cellClass(cell: GridCell) {
  if (!cell.exists) return 'placeholder';
  if (cell.count === 0) return 'empty';
  if (cell.count <= 2) return 'level1';
  if (cell.count <= 5) return 'level2';
  return 'level3';
}

function showTooltip(cell: GridCell, event: MouseEvent) {
  if (!cell.exists) return;
  tooltip.visible = true;
  tooltip.x = event.clientX;
  tooltip.y = event.clientY;
  tooltip.text = cell.count > 0
    ? `${cell.date}  ${cell.count} 次学习行为`
    : `${cell.date}  无学习行为`;
}

function hideTooltip() {
  tooltip.visible = false;
}
</script>

<style scoped>
.heatmapGrid {
  --heatmap-cell: 18px;
  --heatmap-gap: 3px;
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

.monthLabels {
  display: grid;
  grid-template-rows: repeat(12, var(--heatmap-cell));
  gap: var(--heatmap-gap);
  margin-right: var(--spacing-xs);
  margin-top: calc(var(--heatmap-cell) + var(--heatmap-gap));
}

.monthLabels span {
  font-size: 12px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: var(--heatmap-cell);
  white-space: nowrap;
}

.gridContent {
  display: flex;
  flex-direction: column;
  gap: var(--heatmap-gap);
}

.dayHeader {
  display: grid;
  grid-template-columns: repeat(31, var(--heatmap-cell));
  gap: var(--heatmap-gap);
}

.dayHeader span {
  font-size: 11px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--heatmap-cell);
}

.dailyGrid {
  display: grid;
  grid-template-columns: repeat(31, var(--heatmap-cell));
  grid-template-rows: repeat(12, var(--heatmap-cell));
  gap: var(--heatmap-gap);
}

.cell {
  width: var(--heatmap-cell);
  height: var(--heatmap-cell);
  border-radius: 3px;
  cursor: default;
}

.cell.placeholder {
  background: transparent;
}

.cell.empty {
  background-color: var(--color-chart-empty);
}

/* Four grey levels: lighter -> darker */
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
  gap: var(--heatmap-gap);
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
  .heatmapGrid {
    --heatmap-cell: 12px;
    --heatmap-gap: 2px;
  }
  .navBtn {
    width: var(--touch-target-min);
    height: var(--touch-target-min);
    font-size: 14px;
  }
  .monthLabels span {
    font-size: 10px;
  }
  .dayHeader span {
    font-size: 9px;
  }
}
</style>
