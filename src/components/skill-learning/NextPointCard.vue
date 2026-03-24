<template>
  <div v-if="recommendation" class="nextPointCard">
    <p class="nextLabel">建议下一步</p>
    <div class="nextPointInfo">
      <p class="nextPointName">{{ recommendation.name }}</p>
      <p class="nextPointPath">
        {{ recommendation.domain.name }} / {{ recommendation.topic.name }}
      </p>
    </div>
    <button class="nextPointBtn" @click="$emit('navigate', recommendation.pointId)">
      开始学习 →
    </button>
  </div>
  <div v-else-if="loading" class="nextPointCard skeleton">
    <div class="skeletonLine short" />
    <div class="skeletonLine long" />
    <div class="skeletonLine medium" />
  </div>
</template>

<script setup lang="ts">
import type { RecommendedPoint } from '~/composables/skill-learning/types';

defineProps<{
  recommendation: RecommendedPoint | null;
  loading?: boolean;
}>();

defineEmits<{
  navigate: [pointId: number];
}>();
</script>

<style scoped>
.nextPointCard {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-sidebar);
}

.nextLabel {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--spacing-sm);
}

.nextPointInfo {
  margin-bottom: var(--spacing-sm);
}

.nextPointName {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.nextPointPath {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.nextPointBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.nextPointBtn:hover {
  opacity: 0.85;
}

/* Skeleton */
.nextPointCard.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.skeletonLine {
  height: 14px;
  background: var(--color-bg-hover);
  border-radius: 3px;
  animation: shimmer 1.5s infinite;
}

.skeletonLine.long { width: 80%; }
.skeletonLine.medium { width: 50%; }
.skeletonLine.short { width: 30%; }

@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
