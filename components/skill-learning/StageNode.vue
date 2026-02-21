<template>
  <div
    class="stageNode"
    :class="{ current: stage.isCurrent, completed: isCompleted }"
  >
    <!-- Timeline dot -->
    <div class="timelineDot">
      <Check v-if="isCompleted" :size="14" />
      <span v-else class="dotNumber">{{ index + 1 }}</span>
    </div>

    <!-- Content -->
    <div class="nodeContent">
      <button class="nodeHeader" @click="$emit('toggle')">
        <div class="headerInfo">
          <span class="stageName">{{ stage.name }}</span>
          <span v-if="stage.isCurrent" class="currentTag">当前阶段</span>
        </div>
        <ChevronRight
          :size="16"
          class="chevron"
          :class="{ expanded }"
        />
      </button>

      <p v-if="stage.objective" class="stageObjective">{{ stage.objective }}</p>

      <!-- Progress -->
      <div class="stageProgress">
        <div class="progressBar">
          <div class="progressFill" :style="{ width: progressPercent + '%' }" />
        </div>
        <span class="progressText">{{ stage.completedCount }}/{{ stage.pointCount }} · {{ progressPercent }}%</span>
      </div>

      <!-- Expanded point list -->
      <div v-if="expanded" class="expandedArea">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, ChevronRight } from 'lucide-vue-next';
import type { StageWithStats } from '~/composables/skill-learning/types';

const props = defineProps<{
  stage: StageWithStats;
  index: number;
  expanded: boolean;
}>();

defineEmits<{
  toggle: [];
}>();

const isCompleted = computed(() =>
  props.stage.pointCount > 0 && props.stage.completedCount >= props.stage.pointCount,
);

const progressPercent = computed(() =>
  props.stage.pointCount > 0
    ? Math.round((props.stage.completedCount / props.stage.pointCount) * 100)
    : 0,
);
</script>

<style scoped>
.stageNode {
  display: flex;
  gap: var(--spacing-md);
  position: relative;
}

/* Timeline connector line */
.stageNode:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 15px;
  top: 32px;
  bottom: 0;
  width: 2px;
  background: var(--color-border);
}

.stageNode.completed:not(:last-child)::after {
  background: var(--color-accent);
}

/* Timeline dot */
.timelineDot {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
  z-index: 1;
  transition: all var(--transition-fast);
}

.stageNode.current .timelineDot {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.stageNode.completed .timelineDot {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.dotNumber {
  line-height: 1;
}

/* Content */
.nodeContent {
  flex: 1;
  min-width: 0;
  padding-bottom: var(--spacing-lg);
}

.nodeHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.headerInfo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.stageName {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.currentTag {
  display: inline-flex;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.chevron {
  color: var(--color-text-secondary);
  transition: transform var(--transition-fast);
  flex-shrink: 0;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.stageObjective {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  line-height: 1.4;
}

/* Progress */
.stageProgress {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.progressBar {
  flex: 1;
  height: 4px;
  background: var(--color-chart-empty);
  border-radius: 2px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 300ms ease;
}

.progressText {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* Expanded area */
.expandedArea {
  margin-top: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

@media (max-width: 768px) {
  .stageName {
    font-size: 15px;
  }
  .nodeHeader {
    min-height: var(--touch-target-min);
  }
}
</style>
