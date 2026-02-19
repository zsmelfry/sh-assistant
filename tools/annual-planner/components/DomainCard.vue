<template>
  <div
    class="domainCard"
    draggable="true"
    @dragstart="$emit('dragstart', $event)"
    @dragover.prevent="$emit('dragover', $event)"
    @drop="$emit('drop', $event)"
    @click="$emit('click')"
  >
    <div class="cardHeader">
      <h3 class="domainName">{{ domain.name }}</h3>
      <div class="actions">
        <button class="actionBtn" title="编辑" @click.stop="$emit('edit')">
          ✏️
        </button>
        <button class="actionBtn" title="删除" @click.stop="$emit('delete')">
          &times;
        </button>
      </div>
    </div>

    <div class="statsRow">
      <span class="stat">{{ domain.goalCount }} 个目标</span>
      <span class="stat">{{ domain.completedCheckitems }}/{{ domain.totalCheckitems }} 检查项</span>
    </div>

    <div class="progressBar">
      <div class="progressFill" :style="{ width: domain.completionRate + '%' }" />
    </div>
    <span class="completionText">{{ Math.round(domain.completionRate) }}%</span>
  </div>
</template>

<script setup lang="ts">
import type { DomainWithStats } from '../types';

defineProps<{
  domain: DomainWithStats;
}>();

defineEmits<{
  click: [];
  edit: [];
  delete: [];
  dragstart: [e: DragEvent];
  dragover: [e: DragEvent];
  drop: [e: DragEvent];
}>();
</script>

<style scoped>
.domainCard {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.domainCard:hover {
  background-color: var(--color-bg-hover);
}

.cardHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.domainName {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.actions {
  display: flex;
  gap: var(--spacing-xs);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.domainCard:hover .actions {
  opacity: 1;
}

.actionBtn {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  padding: 2px var(--spacing-xs);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
}

.actionBtn:hover {
  background-color: var(--color-bg-primary);
}

.statsRow {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.stat {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.progressBar {
  height: 4px;
  background-color: var(--color-chart-empty);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: var(--spacing-xs);
}

.progressFill {
  height: 100%;
  background-color: var(--color-accent);
  border-radius: 2px;
  transition: width var(--transition-fast);
}

.completionText {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
