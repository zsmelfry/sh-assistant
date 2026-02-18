<template>
  <div class="progressChart">
    <h3 class="chartTitle">学习进度</h3>

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

      <!-- 已掌握面积 -->
      <path :d="masteredArea" class="areaMastered" />
      <!-- 已读面积 -->
      <path :d="readArea" class="areaRead" />

      <!-- 已掌握折线（或单点圆） -->
      <template v-if="store.chartData.length === 1">
        <circle :cx="xScale(0)" :cy="yScale(store.chartData[0].masteredCount)" r="4" class="dotMastered" />
        <circle :cx="xScale(0)" :cy="yScale(store.chartData[0].readCount)" r="4" class="dotRead" />
      </template>
      <template v-else>
        <polyline :points="masteredLine" class="lineMastered" />
        <polyline :points="readLine" class="lineRead" />
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

      <!-- 图例 -->
      <rect :x="width - padding.right - 120" :y="8" width="10" height="10" class="legendMastered" />
      <text :x="width - padding.right - 106" y="17" class="legendText">已掌握</text>
      <rect :x="width - padding.right - 60" :y="8" width="10" height="10" class="legendRead" />
      <text :x="width - padding.right - 46" y="17" class="legendText">已读</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
const store = useVocabStore();

const width = 600;
const height = 250;
const padding = { top: 30, right: 20, bottom: 30, left: 45 };

const chartW = computed(() => width - padding.left - padding.right);
const chartH = computed(() => height - padding.top - padding.bottom);

const maxValue = computed(() => {
  if (store.chartData.length === 0) return 10;
  const max = Math.max(...store.chartData.map(d => Math.max(d.masteredCount, d.readCount)));
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
  const len = store.chartData.length;
  if (len <= 1) return padding.left + chartW.value / 2;
  return padding.left + (i / (len - 1)) * chartW.value;
}

function yScale(val: number): number {
  return padding.top + chartH.value - (val / maxValue.value) * chartH.value;
}

const masteredLine = computed(() =>
  store.chartData.map((d, i) => `${xScale(i)},${yScale(d.masteredCount)}`).join(' '),
);

const readLine = computed(() =>
  store.chartData.map((d, i) => `${xScale(i)},${yScale(d.readCount)}`).join(' '),
);

function buildArea(key: 'masteredCount' | 'readCount'): string {
  const data = store.chartData;
  if (data.length === 0) return '';
  const baseline = yScale(0);
  const points = data.map((d, i) => `${xScale(i)},${yScale(d[key])}`);
  return `M${xScale(0)},${baseline} L${points.join(' L')} L${xScale(data.length - 1)},${baseline} Z`;
}

const masteredArea = computed(() => buildArea('masteredCount'));
const readArea = computed(() => buildArea('readCount'));

const xLabels = computed(() => {
  const data = store.chartData;
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

.chartTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
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
  stroke-width: 2;
}

.lineRead {
  fill: none;
  stroke: var(--color-text-secondary);
  stroke-width: 2;
}

.areaMastered {
  fill: var(--color-accent);
  opacity: 0.1;
}

.areaRead {
  fill: var(--color-text-secondary);
  opacity: 0.08;
}

.dotMastered {
  fill: var(--color-accent);
}

.dotRead {
  fill: var(--color-text-secondary);
}

.legendMastered {
  fill: var(--color-accent);
}

.legendRead {
  fill: var(--color-text-secondary);
}

.legendText {
  font-size: 11px;
  fill: var(--color-text-secondary);
}
</style>
