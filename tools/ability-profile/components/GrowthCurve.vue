<template>
  <div class="growth-curve">
    <h3 class="section-title">成长曲线图</h3>
    <div v-if="snapshots.length < 2" class="empty-hint">
      暂无足够的数据生成曲线图，至少需要两个快照。
    </div>
    <template v-else>
      <svg :viewBox="`0 0 ${width} ${height}`" class="curve-svg">
        <!-- Grid lines -->
        <line
          v-for="tick in yTicks"
          :key="`grid-${tick}`"
          :x1="padding.left"
          :y1="yScale(tick)"
          :x2="width - padding.right"
          :y2="yScale(tick)"
          class="grid-line"
        />

        <!-- Y axis labels -->
        <text
          v-for="tick in yTicks"
          :key="`ylabel-${tick}`"
          :x="padding.left - 6"
          :y="yScale(tick) + 3"
          class="axis-label"
          text-anchor="end"
        >
          {{ tick }}
        </text>

        <!-- X axis labels -->
        <text
          v-for="(label, i) in xLabels"
          :key="`xlabel-${i}`"
          :x="xScale(i)"
          :y="height - padding.bottom + 16"
          class="axis-label"
          text-anchor="middle"
        >
          {{ label }}
        </text>

        <!-- Data lines per category -->
        <g v-for="(cat, ci) in categories" :key="`line-${cat.id}`">
          <polyline
            :points="getLinePoints(cat.id)"
            class="data-line"
            :stroke-dasharray="dashPatterns[ci % dashPatterns.length]"
            fill="none"
          />
          <!-- Data dots -->
          <circle
            v-for="(snap, si) in snapshots"
            :key="`dot-${cat.id}-${si}`"
            :cx="xScale(si)"
            :cy="yScale(getScore(snap, cat.id))"
            r="2.5"
            class="data-dot"
          />
        </g>

        <!-- Axes -->
        <line :x1="padding.left" :y1="padding.top" :x2="padding.left" :y2="height - padding.bottom" class="axis-line" />
        <line :x1="padding.left" :y1="height - padding.bottom" :x2="width - padding.right" :y2="height - padding.bottom" class="axis-line" />
      </svg>

      <!-- Legend -->
      <div class="legend">
        <div v-for="(cat, ci) in categories" :key="`legend-${cat.id}`" class="legend-item">
          <svg width="24" height="10" class="legend-line-svg">
            <line
              x1="0" y1="5" x2="24" y2="5"
              stroke="var(--color-accent)"
              stroke-width="1.5"
              :stroke-dasharray="dashPatterns[ci % dashPatterns.length]"
            />
          </svg>
          <span class="legend-label">{{ cat.name }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  snapshots: Array<{ date: string; radarData: any[] }>;
  categories: Array<{ id: number; name: string }>;
}>();

const width = 600;
const height = 300;
const padding = { top: 20, right: 20, bottom: 30, left: 40 };

const dashPatterns = ['none', '6,3', '2,3', '8,3,2,3', '4,4'];

const yTicks = [0, 25, 50, 75, 100];

function yScale(value: number) {
  const plotH = height - padding.top - padding.bottom;
  return height - padding.bottom - (value / 100) * plotH;
}

function xScale(index: number) {
  const plotW = width - padding.left - padding.right;
  const count = props.snapshots.length;
  if (count <= 1) return padding.left + plotW / 2;
  return padding.left + (index / (count - 1)) * plotW;
}

const xLabels = computed(() =>
  props.snapshots.map(s => {
    const d = new Date(s.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }),
);

function getScore(snapshot: { date: string; radarData: any[] }, categoryId: number): number {
  const entry = snapshot.radarData?.find((r: any) => r.categoryId === categoryId);
  return entry?.score ?? 0;
}

function getLinePoints(categoryId: number) {
  return props.snapshots
    .map((snap, i) => `${xScale(i)},${yScale(getScore(snap, categoryId))}`)
    .join(' ');
}
</script>

<style scoped>
.growth-curve {
  margin-top: var(--spacing-lg);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-md);
}

.empty-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: var(--spacing-lg);
  text-align: center;
}

.curve-svg {
  width: 100%;
  max-width: 600px;
}

.grid-line {
  stroke: var(--color-border);
  stroke-width: 0.5;
}

.axis-line {
  stroke: var(--color-text-secondary);
  stroke-width: 1;
}

.axis-label {
  font-size: 10px;
  fill: var(--color-text-secondary);
}

.data-line {
  stroke: var(--color-accent);
  stroke-width: 1.5;
}

.data-dot {
  fill: var(--color-accent);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-top: var(--spacing-sm);
  padding-left: var(--spacing-md);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.legend-line-svg {
  flex-shrink: 0;
}

.legend-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
