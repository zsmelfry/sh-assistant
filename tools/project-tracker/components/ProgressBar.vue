<template>
  <div class="progressBar">
    <div class="progressHeader">
      <span class="progressLabel">进度</span>
      <span class="progressPct">{{ progress.percentage }}%</span>
    </div>
    <div class="progressTrack">
      <div
        v-for="(seg, idx) in segments"
        :key="idx"
        class="progressSegment"
        :style="{ flex: seg.total }"
        :title="`${seg.title}: ${seg.done}/${seg.total}`"
      >
        <div class="segmentFill" :style="{ width: seg.pct + '%' }" />
      </div>
    </div>
    <div v-if="progress.milestones.length > 1" class="segmentLabels">
      <span
        v-for="(seg, idx) in segments"
        :key="idx"
        class="segmentLabel"
        :style="{ flex: seg.total }"
      >
        {{ seg.title }} ({{ seg.done }}/{{ seg.total }})
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProgressData } from '../types';

const props = defineProps<{
  progress: ProgressData;
}>();

const segments = computed(() =>
  props.progress.milestones.map(m => ({
    title: m.title,
    total: m.total || 1, // avoid flex: 0
    done: m.done,
    pct: m.total > 0 ? Math.round((m.done / m.total) * 100) : 0,
  })),
);
</script>

<style scoped>
.progressBar {
  margin-bottom: var(--spacing-md);
}

.progressHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.progressLabel {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.progressPct {
  font-size: 14px;
  font-weight: 700;
}

.progressTrack {
  display: flex;
  height: 8px;
  background: var(--color-border);
  border-radius: 4px;
  overflow: hidden;
  gap: 1px;
}

.progressSegment {
  background: var(--color-bg-hover);
  overflow: hidden;
}

.progressSegment:first-child {
  border-radius: 4px 0 0 4px;
}

.progressSegment:last-child {
  border-radius: 0 4px 4px 0;
}

.segmentFill {
  height: 100%;
  background: var(--color-accent);
  transition: width var(--transition-fast);
}

.segmentLabels {
  display: flex;
  gap: 1px;
  margin-top: 2px;
}

.segmentLabel {
  font-size: 10px;
  color: var(--color-text-secondary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
