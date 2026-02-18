<template>
  <div class="trendContainer">
    <svg :viewBox="`0 0 ${width} ${height}`" class="trendChart">
      <!-- 网格线 -->
      <line
        v-for="y in yGridLines"
        :key="'grid-' + y"
        :x1="padding.left"
        :y1="y"
        :x2="width - padding.right"
        :y2="y"
        class="gridLine"
      />

      <!-- 填充区域 -->
      <polygon v-if="dataPoints.length > 0" :points="areaPoints" class="areaFill" />

      <!-- 折线 -->
      <polyline v-if="dataPoints.length > 0" :points="linePoints" class="line" />

      <!-- 数据点 -->
      <circle
        v-for="point in dataPoints"
        :key="point.month"
        :cx="point.x"
        :cy="point.y"
        r="4"
        class="dot"
        @mouseenter="showTooltip(point, $event)"
        @mouseleave="hideTooltip"
      />

      <!-- X 轴标签 -->
      <text
        v-for="label in xLabels"
        :key="'x-' + label.text"
        :x="label.x"
        :y="height - 4"
        class="axisLabel"
        text-anchor="middle"
      >
        {{ label.text }}
      </text>

      <!-- Y 轴标签 -->
      <text
        v-for="label in yLabels"
        :key="'y-' + label.text"
        :x="padding.left - 4"
        :y="label.y + 4"
        class="axisLabel"
        text-anchor="end"
      >
        {{ label.text }}
      </text>
    </svg>

    <ChartTooltip
      :visible="tooltip.visible"
      :x="tooltip.x"
      :y="tooltip.y"
      :text="tooltip.text"
    />
  </div>
</template>

<script setup lang="ts">
import type { HabitFrequency } from '~/types';
import type { TrendResponse, TrendMonth } from '~/types/api';
import ChartTooltip from './ChartTooltip.vue';

const props = defineProps<{
  habitId: string;
  frequency: HabitFrequency;
}>();

const width = 500;
const height = 200;
const padding = { top: 20, right: 20, bottom: 30, left: 40 };

const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  text: '',
});

const trendData = ref<TrendMonth[]>([]);

async function loadData() {
  if (!props.habitId) return;
  const data = await $fetch<TrendResponse>('/api/checkins/trend', {
    params: { habitId: props.habitId, months: 12 },
  });
  trendData.value = data.months;
}

watch([() => props.habitId, () => props.frequency], loadData, { immediate: true });

const chartWidth = width - padding.left - padding.right;
const chartHeight = height - padding.top - padding.bottom;

const dataPoints = computed(() => {
  if (trendData.value.length === 0) return [];
  const count = trendData.value.length;
  return trendData.value.map((m, i) => {
    const x = padding.left + (count > 1 ? (i / (count - 1)) * chartWidth : chartWidth / 2);
    const y = padding.top + chartHeight - (m.rate / 100) * chartHeight;
    const [yearStr, monthStr] = m.month.split('-');
    const unitLabel = props.frequency === 'weekly' ? '周' : '天';
    return {
      month: m.month,
      x,
      y,
      rate: m.rate,
      tooltipText: `${yearStr}年${parseInt(monthStr)}月: ${m.rate}% (${m.completed}/${m.total}${unitLabel})`,
    };
  });
});

const linePoints = computed(() =>
  dataPoints.value.map(p => `${p.x},${p.y}`).join(' '),
);

const areaPoints = computed(() => {
  if (dataPoints.value.length === 0) return '';
  const points = dataPoints.value.map(p => `${p.x},${p.y}`);
  const first = dataPoints.value[0];
  const last = dataPoints.value[dataPoints.value.length - 1];
  const baseline = padding.top + chartHeight;
  return [
    `${first.x},${baseline}`,
    ...points,
    `${last.x},${baseline}`,
  ].join(' ');
});

const yGridLines = computed(() => {
  return [0, 25, 50, 75, 100].map(
    pct => padding.top + chartHeight - (pct / 100) * chartHeight,
  );
});

const xLabels = computed(() => {
  return dataPoints.value.map(p => {
    const monthNum = parseInt(p.month.split('-')[1]);
    return { x: p.x, text: `${monthNum}月` };
  });
});

const yLabels = computed(() => {
  return [0, 25, 50, 75, 100].map(pct => ({
    y: padding.top + chartHeight - (pct / 100) * chartHeight,
    text: `${pct}%`,
  }));
});

function showTooltip(point: { tooltipText: string }, event: MouseEvent) {
  tooltip.visible = true;
  tooltip.x = event.clientX;
  tooltip.y = event.clientY;
  tooltip.text = point.tooltipText;
}

function hideTooltip() {
  tooltip.visible = false;
}
</script>

<style scoped>
.trendContainer {
  position: relative;
}

.trendChart {
  width: 100%;
  max-width: 500px;
  height: auto;
}

.gridLine {
  stroke: var(--color-chart-grid);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.areaFill {
  fill: var(--color-chart-bg);
}

.line {
  fill: none;
  stroke: var(--color-chart-fill);
  stroke-width: 2;
}

.dot {
  fill: var(--color-chart-fill);
  cursor: pointer;
}

.dot:hover {
  r: 6;
}

.axisLabel {
  font-size: 11px;
  fill: var(--color-text-secondary);
}
</style>
