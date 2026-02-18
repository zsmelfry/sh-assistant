<template>
  <div class="habitList">
    <div class="listHeader">
      <h3 class="listTitle">习惯列表</h3>
      <button class="newBtn" @click="$emit('new')">+ 新建</button>
    </div>

    <div class="listItems">
      <div
        v-for="habit in habits"
        :key="habit.id"
        class="habitItem"
        :class="{ active: habit.id === selectedId }"
        @click="$emit('select', habit.id)"
      >
        <div class="habitInfo">
          <span class="habitName">{{ habit.name }}</span>
          <span class="frequencyBadge">{{ FREQUENCY_BADGES[habit.frequency] }}</span>
        </div>
        <div class="habitActions">
          <button
            class="actionBtn"
            aria-label="编辑"
            @click.stop="$emit('edit', habit)"
          >
            ✎
          </button>
          <button
            class="actionBtn"
            aria-label="删除"
            @click.stop="$emit('delete', habit)"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Habit } from '~/types';
import { FREQUENCY_BADGES } from '../types';

defineProps<{
  habits: Habit[];
  selectedId: string | null;
}>();

defineEmits<{
  select: [id: string];
  new: [];
  edit: [habit: Habit];
  delete: [habit: Habit];
}>();
</script>

<style scoped>
.habitList {
  border-right: 1px solid var(--color-border);
  width: 220px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.listHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.listTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.newBtn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-primary);
}

.newBtn:hover {
  background-color: var(--color-bg-hover);
}

.listItems {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

.habitItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.habitItem:hover {
  background-color: var(--color-bg-hover);
}

.habitItem.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.habitItem.active .frequencyBadge {
  background-color: var(--color-accent-inverse);
  color: var(--color-accent);
}

.habitItem.active .actionBtn {
  color: var(--color-accent-inverse);
}

.habitInfo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.habitName {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frequencyBadge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.habitActions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.habitItem:hover .habitActions,
.habitItem.active .habitActions {
  opacity: 1;
}

.actionBtn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.actionBtn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}
</style>
