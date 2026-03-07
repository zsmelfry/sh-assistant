<template>
  <div class="radar-container">
    <svg :viewBox="`0 0 ${size} ${size}`" class="radar-svg">
      <!-- Background grid -->
      <polygon
        v-for="level in 5"
        :key="level"
        :points="getGridPoints(level / 5)"
        class="radar-grid"
      />

      <!-- Axis lines -->
      <line
        v-for="(_, i) in points"
        :key="`axis-${i}`"
        :x1="center"
        :y1="center"
        :x2="getPoint(i, 1).x"
        :y2="getPoint(i, 1).y"
        class="radar-axis"
      />

      <!-- Data polygon -->
      <polygon
        v-if="hasData"
        :points="dataPoints"
        class="radar-data"
      />

      <!-- Data points -->
      <circle
        v-for="(point, i) in points"
        :key="`dot-${i}`"
        :cx="getPoint(i, point.score / 100).x"
        :cy="getPoint(i, point.score / 100).y"
        :r="3"
        class="radar-dot"
        :class="{ 'radar-dot--insufficient': !point.sufficient }"
      />

      <!-- Labels -->
      <text
        v-for="(point, i) in points"
        :key="`label-${i}`"
        :x="getLabelPos(i).x"
        :y="getLabelPos(i).y"
        class="radar-label"
        :text-anchor="getLabelAnchor(i)"
        dominant-baseline="middle"
      >
        {{ point.categoryName }}
      </text>

      <!-- Score labels -->
      <text
        v-for="(point, i) in points"
        :key="`score-${i}`"
        :x="getLabelPos(i).x"
        :y="getLabelPos(i).y + 14"
        class="radar-score"
        :text-anchor="getLabelAnchor(i)"
        dominant-baseline="middle"
      >
        {{ point.skillCount > 0 ? point.score : '-' }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import type { RadarPoint } from '../types';

const props = defineProps<{
  points: RadarPoint[];
}>();

const size = 300;
const center = size / 2;
const radius = 100;

const hasData = computed(() => props.points.some((p) => p.score > 0));

function getPoint(index: number, scale: number) {
  const angle = (Math.PI * 2 * index) / props.points.length - Math.PI / 2;
  return {
    x: center + radius * scale * Math.cos(angle),
    y: center + radius * scale * Math.sin(angle),
  };
}

function getGridPoints(scale: number) {
  return props.points
    .map((_, i) => {
      const p = getPoint(i, scale);
      return `${p.x},${p.y}`;
    })
    .join(' ');
}

const dataPoints = computed(() => {
  return props.points
    .map((p, i) => {
      const pt = getPoint(i, Math.max(p.score / 100, 0.02));
      return `${pt.x},${pt.y}`;
    })
    .join(' ');
});

function getLabelPos(index: number) {
  const angle = (Math.PI * 2 * index) / props.points.length - Math.PI / 2;
  const labelRadius = radius + 30;
  return {
    x: center + labelRadius * Math.cos(angle),
    y: center + labelRadius * Math.sin(angle),
  };
}

function getLabelAnchor(index: number) {
  const angle = (Math.PI * 2 * index) / props.points.length - Math.PI / 2;
  const cos = Math.cos(angle);
  if (Math.abs(cos) < 0.1) return 'middle';
  return cos > 0 ? 'start' : 'end';
}
</script>

<style scoped>
.radar-container {
  display: flex;
  justify-content: center;
  padding: var(--spacing-md);
}

.radar-svg {
  width: 100%;
  max-width: 360px;
}

.radar-grid {
  fill: none;
  stroke: var(--color-border);
  stroke-width: 0.5;
}

.radar-axis {
  stroke: var(--color-border);
  stroke-width: 0.5;
}

.radar-data {
  fill: var(--color-accent);
  fill-opacity: 0.08;
  stroke: var(--color-accent);
  stroke-width: 1.5;
}

.radar-dot {
  fill: var(--color-accent);
}

.radar-dot--insufficient {
  fill: var(--color-text-secondary);
  stroke: var(--color-text-secondary);
}

.radar-label {
  font-size: 11px;
  fill: var(--color-text-primary);
  font-weight: 500;
}

.radar-score {
  font-size: 10px;
  fill: var(--color-text-secondary);
}
</style>
