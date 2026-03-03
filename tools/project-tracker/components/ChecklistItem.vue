<template>
  <div class="checklistItem" :class="{ completed: item.isCompleted }">
    <input
      type="checkbox"
      class="checkbox"
      :checked="item.isCompleted"
      @change="$emit('toggle')"
    />
    <div class="itemContent">
      <span class="itemText">{{ item.content }}</span>
      <div v-if="item.dueDate || item.reminderAt" class="itemMeta">
        <span v-if="item.dueDate" class="dueDate" :class="{ overdue: isOverdue && !item.isCompleted }">
          {{ item.dueDate }}
        </span>
        <span v-if="item.reminderAt" class="reminderBadge" :title="formatReminder(item.reminderAt)">
          ⏰ {{ formatReminder(item.reminderAt) }}
        </span>
      </div>
    </div>
    <div class="itemActions">
      <button class="iconBtn" @click="$emit('edit')">✏️</button>
      <button class="iconBtn" @click="$emit('delete')">&times;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChecklistItem } from '../types';

const props = defineProps<{
  item: ChecklistItem;
}>();

defineEmits<{
  toggle: [];
  edit: [];
  delete: [];
}>();

const isOverdue = computed(() => {
  if (!props.item.dueDate) return false;
  return props.item.dueDate < new Date().toISOString().slice(0, 10);
});

function formatReminder(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<style scoped>
.checklistItem {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.checklistItem:hover {
  background: var(--color-bg-hover);
}

.checklistItem.completed .itemText {
  text-decoration: line-through;
  color: var(--color-text-disabled);
}

.itemContent {
  flex: 1;
  min-width: 0;
}

.itemText {
  font-size: 14px;
}

.itemMeta {
  margin-top: 1px;
}

.dueDate {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.dueDate.overdue {
  color: var(--color-danger);
  font-weight: 600;
}

.reminderBadge {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-left: var(--spacing-xs);
}

.itemActions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.checklistItem:hover .itemActions {
  opacity: 1;
}

.iconBtn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 12px;
  opacity: 0.5;
}

.iconBtn:hover {
  opacity: 1;
}
</style>
