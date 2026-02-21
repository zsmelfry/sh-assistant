<template>
  <div class="stagePointList">
    <div v-if="loading" class="loadingState">加载中...</div>

    <template v-else-if="points.length > 0">
      <div
        v-for="point in points"
        :key="point.pointId"
        class="pointRow"
        @click="$emit('navigate-point', point.pointId)"
      >
        <div class="pointInfo">
          <span class="pointName">{{ point.name }}</span>
          <span class="pointMeta">{{ point.domain.name }} / {{ point.topic.name }}</span>
        </div>
        <StatusBadge :status="point.status" />
      </div>
    </template>

    <div v-else class="emptyState">
      暂无知识点
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusBadge from './StatusBadge.vue';
import type { StagePointItem } from '../types';

defineProps<{
  points: StagePointItem[];
  loading?: boolean;
}>();

defineEmits<{
  'navigate-point': [pointId: number];
}>();
</script>

<style scoped>
.stagePointList {
  display: flex;
  flex-direction: column;
}

.loadingState {
  padding: var(--spacing-md);
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.pointRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.pointRow:hover {
  background-color: var(--color-bg-hover);
}

.pointRow:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.pointInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pointName {
  font-size: 14px;
  color: var(--color-text-primary);
}

.pointMeta {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emptyState {
  padding: var(--spacing-md);
  text-align: center;
  font-size: 13px;
  color: var(--color-text-disabled);
}

@media (max-width: 768px) {
  .pointRow {
    min-height: var(--touch-target-min);
  }
}
</style>
