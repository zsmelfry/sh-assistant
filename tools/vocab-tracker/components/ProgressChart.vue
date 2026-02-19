<template>
  <div class="progressChart">
    <div class="chartHeader">
      <h3 class="chartTitle">学习进度</h3>
      <div class="chartModes">
        <button
          class="modeBtn"
          :class="{ active: chartMode === 'cumulative' }"
          @click="chartMode = 'cumulative'"
        >
          总量
        </button>
        <button
          class="modeBtn"
          :class="{ active: chartMode === 'daily' }"
          @click="chartMode = 'daily'"
        >
          每日
        </button>
      </div>
    </div>

    <div v-if="store.chartData.length === 0" class="empty">
      暂无数据
    </div>

    <svg
      v-else
      :viewBox="`0 0 ${width} ${height}`"
      class="chart"
    >
      <!-- Y 轴刻度线 -->
      <line
        v-for="tick in yTicks"
        :key="tick"
        :x1="padding.left"
        :y1="yScale(tick)"
        :x2="width - padding.right"
        :y2="yScale(tick)"
        stroke="var(--color-border)"
        stroke-dasharray="3,3"
      />
      <!-- Y 轴刻度标签 -->
      <text
        v-for="tick in yTicks"
        :key="'label-' + tick"
        :x="padding.left - 8"
        :y="yScale(tick) + 4"
        text-anchor="end"
        class="tickLabel"
      >
        {{ tick }}
      </text>

      <!-- 已读面积（在下层） -->
      <path :d="readArea" class="areaRead" />
      <!-- 已掌握面积（在上层） -->
      <path :d="masteredArea" class="areaMastered" />

      <!-- 折线或单点 -->
      <template v-if="displayData.length === 1">
        <circle :cx="xScale(0)" :cy="yScale(displayData[0].masteredCount)" r="4" class="dotMastered" />
        <circle :cx="xScale(0)" :cy="yScale(displayData[0].readCount)" r="4" class="dotRead" />
      </template>
      <template v-else>
        <!-- 已读折线（先画，在下层） -->
        <polyline :points="readLine" class="lineRead" />
        <!-- 已掌握折线（后画，在上层） -->
        <polyline :points="masteredLine" class="lineMastered" />
      </template>

      <!-- X 轴标签 -->
      <text
        v-for="(label, i) in xLabels"
        :key="'x-' + i"
        :x="xScale(label.index)"
        :y="height - 4"
        text-anchor="middle"
        class="tickLabel"
      >
        {{ label.text }}
      </text>

      <!-- 悬停交互层 -->
      <template v-if="displayData.length > 1">
        <!-- 垂直参考线 -->
        <line
          v-if="hoverIndex !== null"
          :x1="xScale(hoverIndex)"
          :y1="padding.top"
          :x2="xScale(hoverIndex)"
          :y2="height - padding.bottom"
          stroke="var(--color-border)"
          stroke-width="1"
        />
        <!-- 悬停点 -->
        <template v-if="hoverIndex !== null">
          <circle
            :cx="xScale(hoverIndex)"
            :cy="yScale(displayData[hoverIndex].readCount)"
            r="3.5"
            class="dotRead"
            stroke="var(--color-bg-primary)"
            stroke-width="1.5"
          />
          <circle
            :cx="xScale(hoverIndex)"
            :cy="yScale(displayData[hoverIndex].masteredCount)"
            r="3.5"
            class="dotMastered"
            stroke="var(--color-bg-primary)"
            stroke-width="1.5"
          />
        </template>
        <!-- 透明命中区域 -->
        <rect
          v-for="(d, i) in displayData"
          :key="'hit-' + i"
          :x="hitArea(i).x"
          :y="padding.top"
          :width="hitArea(i).w"
          :height="height - padding.top - padding.bottom"
          fill="transparent"
          @mouseenter="hoverIndex = i"
          @mouseleave="hoverIndex = null"
        />
      </template>

      <!-- 悬停提示框 -->
      <g v-if="hoverIndex !== null && displayData.length > 1" :transform="tooltipTransform">
        <rect
          x="0"
          y="0"
          :width="tooltipW"
          height="46"
          rx="4"
          fill="var(--color-text-primary)"
          opacity="0.92"
        />
        <text x="8" y="15" class="tooltipDate">{{ displayData[hoverIndex].date.slice(5) }}</text>
        <text x="8" y="30" class="tooltipValue">已掌握 {{ displayData[hoverIndex].masteredCount }}</text>
        <text x="8" y="43" class="tooltipValue">已读 {{ displayData[hoverIndex].readCount }}</text>
      </g>

      <!-- 图例（用线段展示样式） -->
      <line
        :x1="width - padding.right - 134"
        :y1="14"
        :x2="width - padding.right - 118"
        :y2="14"
        class="lineMastered"
      />
      <text :x="width - padding.right - 114" y="18" class="legendText">已掌握</text>
      <line
        :x1="width - padding.right - 66"
        :y1="14"
        :x2="width - padding.right - 50"
        :y2="14"
        class="lineRead"
      />
      <text :x="width - padding.right - 46" y="18" class="legendText">已读</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import type { ChartDataPoint } from '../types';

const store = useVocabStore();

const width = 600;
const height = 250;
const padding = { top: 30, right: 20, bottom: 30, left: 45 };

const chartW = computed(() => width - padding.left - padding.right);
const chartH = computed(() => height - padding.top - padding.bottom);

const chartMode = ref<'cumulative' | 'daily'>('cumulative');
const hoverIndex = ref<number | null>(null);

const cumulativeData = computed((): ChartDataPoint[] => {
  const data = store.chartData;
  if (data.length === 0) return [];
  const result: ChartDataPoint[] = [];
  let masteredSum = 0;
  let readSum = 0;
  for (const d of data) {
    masteredSum += d.masteredCount;
    readSum += d.readCount;
    result.push({ date: d.date, masteredCount: masteredSum, readCount: readSum });
  }
  return result;
});

const displayData = computed(() =>
  chartMode.value === 'cumulative' ? cumulativeData.value : store.chartData,
);

const maxValue = computed(() => {
  if (displayData.value.length === 0) return 10;
  const max = Math.max(...displayData.value.map(d => Math.max(d.masteredCount, d.readCount)));
  return max > 0 ? max : 10;
});

const yTicks = computed(() => {
  const max = maxValue.value;
  const step = Math.ceil(max / 4);
  const ticks: number[] = [];
  for (let i = 0; i <= max; i += step) {
    ticks.push(i);
  }
  if (ticks[ticks.length - 1] < max) ticks.push(max);
  return ticks;
});

function xScale(i: number): number {
  const len = displayData.value.length;
  if (len <= 1) return padding.left + chartW.value / 2;
  return padding.left + (i / (len - 1)) * chartW.value;
}

function yScale(val: number): number {
  return padding.top + chartH.value - (val / maxValue.value) * chartH.value;
}

const masteredLine = computed(() =>
  displayData.value.map((d, i) => `${xScale(i)},${yScale(d.masteredCount)}`).join(' '),
);

const readLine = computed(() =>
  displayData.value.map((d, i) => `${xScale(i)},${yScale(d.readCount)}`).join(' '),
);

function buildArea(key: 'masteredCount' | 'readCount'): string {
  const data = displayData.value;
  if (data.length === 0) return '';
  const baseline = yScale(0);
  const points = data.map((d, i) => `${xScale(i)},${yScale(d[key])}`);
  return `M${xScale(0)},${baseline} L${points.join(' L')} L${xScale(data.length - 1)},${baseline} Z`;
}

const masteredArea = computed(() => buildArea('masteredCount'));
const readArea = computed(() => buildArea('readCount'));

const tooltipW = 96;

function hitArea(i: number) {
  const len = displayData.value.length;
  if (len <= 1) return { x: padding.left, w: chartW.value };
  const step = chartW.value / (len - 1);
  if (i === 0) return { x: padding.left, w: step / 2 };
  if (i === len - 1) return { x: xScale(i) - step / 2, w: step / 2 };
  return { x: xScale(i) - step / 2, w: step };
}

const tooltipTransform = computed(() => {
  if (hoverIndex.value === null) return '';
  const cx = xScale(hoverIndex.value);
  // Flip tooltip to the left if near right edge
  const tx = cx + tooltipW + 8 > width - padding.right ? cx - tooltipW - 8 : cx + 8;
  return `translate(${tx}, ${padding.top})`;
});

const xLabels = computed(() => {
  const data = displayData.value;
  if (data.length === 0) return [];
  const step = Math.max(1, Math.floor(data.length / 6));
  const labels: { index: number; text: string }[] = [];
  for (let i = 0; i < data.length; i += step) {
    labels.push({ index: i, text: data[i].date.slice(5) }); // MM-DD
  }
  // 确保最后一个日期显示
  if (labels[labels.length - 1]?.index !== data.length - 1) {
    labels.push({ index: data.length - 1, text: data[data.length - 1].date.slice(5) });
  }
  return labels;
});
</script>

<style scoped>
.progressChart {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.chartHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.chartTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.chartModes {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.modeBtn {
  padding: 2px var(--spacing-sm);
  border: none;
  background: var(--color-bg-primary);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.modeBtn:not(:last-child) {
  border-right: 1px solid var(--color-border);
}

.modeBtn.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.modeBtn:hover:not(.active) {
  background-color: var(--color-bg-hover);
}

.chart {
  width: 100%;
  height: auto;
}

.empty {
  text-align: center;
  padding: var(--spacing-lg) 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.tickLabel {
  font-size: 10px;
  fill: var(--color-text-secondary);
}

.lineMastered {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 2.5;
}

.lineRead {
  fill: none;
  stroke: var(--color-text-secondary);
  stroke-width: 1.5;
  stroke-dasharray: 6,3;
}

.areaMastered {
  fill: var(--color-accent);
  opacity: 0.12;
}

.areaRead {
  fill: var(--color-text-secondary);
  opacity: 0.06;
}

.dotMastered {
  fill: var(--color-accent);
}

.dotRead {
  fill: var(--color-text-secondary);
}

.legendText {
  font-size: 11px;
  fill: var(--color-text-secondary);
}

.tooltipDate {
  font-size: 10px;
  fill: var(--color-text-secondary);
}

.tooltipValue {
  font-size: 10px;
  fill: var(--color-accent-inverse);
}
</style>
