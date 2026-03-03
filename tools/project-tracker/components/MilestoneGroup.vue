<template>
  <div class="milestoneGroup">
    <div class="groupHeader" @click="collapsed = !collapsed">
      <span class="collapseIcon">{{ collapsed ? '▶' : '▼' }}</span>
      <h4 class="groupTitle">{{ milestone.title }}</h4>
      <span class="groupStats">{{ milestone.done }}/{{ milestone.total }}</span>
      <span v-if="milestone.dueDate" class="groupDue">{{ milestone.dueDate }}</span>
      <div v-if="milestone.id !== 0" class="groupActions" @click.stop>
        <button class="iconBtn" @click="$emit('edit-milestone')">✏️</button>
        <button class="iconBtn" @click="$emit('delete-milestone')">&times;</button>
      </div>
    </div>

    <div v-show="!collapsed" class="groupBody">
      <ChecklistItem
        v-for="item in milestone.items"
        :key="item.id"
        :item="item"
        @toggle="$emit('toggle-item', item.id)"
        @edit="$emit('edit-item', item)"
        @delete="$emit('delete-item', item.id)"
      />

      <!-- Quick add -->
      <div class="quickAdd">
        <input
          v-model="newContent"
          type="text"
          placeholder="+ 添加任务..."
          @keydown.enter="handleAdd"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MilestoneWithItems, ChecklistItem as ChecklistItemType } from '../types';
import ChecklistItem from './ChecklistItem.vue';

const props = defineProps<{
  milestone: MilestoneWithItems;
}>();

const emit = defineEmits<{
  'edit-milestone': [];
  'delete-milestone': [];
  'toggle-item': [id: number];
  'edit-item': [item: ChecklistItemType];
  'delete-item': [id: number];
  'add-item': [content: string, milestoneId: number | null];
}>();

const collapsed = ref(false);
const newContent = ref('');

function handleAdd() {
  const content = newContent.value.trim();
  if (!content) return;
  const milestoneId = props.milestone.id === 0 ? null : props.milestone.id;
  emit('add-item', content, milestoneId);
  newContent.value = '';
}
</script>

<style scoped>
.milestoneGroup {
  margin-bottom: var(--spacing-md);
}

.groupHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.groupHeader:hover {
  background: var(--color-bg-hover);
}

.collapseIcon {
  font-size: 10px;
  color: var(--color-text-secondary);
  width: 14px;
}

.groupTitle {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
}

.groupStats {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
  padding: 1px 6px;
  border-radius: 8px;
}

.groupDue {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.groupActions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.groupHeader:hover .groupActions {
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

.groupBody {
  padding-left: var(--spacing-lg);
}

.quickAdd input {
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  border-bottom: 1px dashed var(--color-border);
  font-size: 13px;
  background: transparent;
  color: var(--color-text-primary);
  outline: none;
}

.quickAdd input::placeholder {
  color: var(--color-text-disabled);
}
</style>
