<template>
  <div class="checkitemList">
    <div
      v-for="item in checkitems"
      :key="item.id"
      class="checkitemRow"
      draggable="true"
      @dragstart="onDragStart($event, item.id)"
      @dragover.prevent="onDragOver($event, item.id)"
      @drop="onDrop($event, item.id)"
      @dragend="dragId = null"
    >
      <input
        type="checkbox"
        class="checkbox"
        :checked="item.isCompleted"
        @change="$emit('toggle', item.id)"
      />
      <span
        v-if="editingId !== item.id"
        class="content"
        :class="{ completed: item.isCompleted }"
        @dblclick="startEdit(item)"
      >
        {{ item.content }}
      </span>
      <input
        v-else
        ref="editInputRef"
        v-model="editContent"
        class="editInput"
        type="text"
        @keydown.enter="commitEdit(item.id)"
        @keydown.escape="cancelEdit"
        @blur="commitEdit(item.id)"
      />
      <button
        v-if="editingId !== item.id"
        class="deleteBtn"
        title="删除"
        @click="$emit('delete', item.id)"
      >
        &times;
      </button>
    </div>

    <div v-if="showInput" class="addRow">
      <CheckitemInput
        @submit="$emit('add', $event)"
        @cancel="$emit('hideInput')"
      />
    </div>
    <button v-else class="addBtn" @click="$emit('showInput')">
      + 添加检查项
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PlannerCheckitem } from '../types';
import CheckitemInput from './CheckitemInput.vue';

const props = defineProps<{
  checkitems: PlannerCheckitem[];
  showInput: boolean;
}>();

const emit = defineEmits<{
  toggle: [id: number];
  delete: [id: number];
  add: [content: string];
  showInput: [];
  hideInput: [];
  update: [id: number, content: string];
  reorder: [items: { id: number; sortOrder: number }[]];
}>();

const editingId = ref<number | null>(null);
const editContent = ref('');
const editInputRef = ref<HTMLInputElement[] | null>(null);

function startEdit(item: PlannerCheckitem) {
  editingId.value = item.id;
  editContent.value = item.content;
  nextTick(() => {
    if (editInputRef.value?.[0]) {
      editInputRef.value[0].focus();
    }
  });
}

function commitEdit(id: number) {
  const trimmed = editContent.value.trim();
  if (trimmed && trimmed !== props.checkitems.find(c => c.id === id)?.content) {
    emit('update', id, trimmed);
  }
  cancelEdit();
}

function cancelEdit() {
  editingId.value = null;
  editContent.value = '';
}

// Drag & drop
const dragId = ref<number | null>(null);

function onDragStart(e: DragEvent, id: number) {
  dragId.value = id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
}

function onDragOver(e: DragEvent, _id: number) {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
}

function onDrop(_e: DragEvent, targetId: number) {
  if (dragId.value === null || dragId.value === targetId) return;

  const items = [...props.checkitems];
  const dragIdx = items.findIndex(c => c.id === dragId.value);
  const targetIdx = items.findIndex(c => c.id === targetId);
  if (dragIdx === -1 || targetIdx === -1) return;

  const [moved] = items.splice(dragIdx, 1);
  items.splice(targetIdx, 0, moved);

  const reordered = items.map((item, i) => ({ id: item.id, sortOrder: i }));
  emit('reorder', reordered);
  dragId.value = null;
}
</script>

<style scoped>
.checkitemList {
  margin-top: var(--spacing-sm);
}

.checkitemRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  cursor: grab;
}

.checkitemRow:active {
  cursor: grabbing;
}

.content {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: default;
}

.content.completed {
  text-decoration: line-through;
  color: var(--color-text-disabled);
}

.editInput {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
}

.deleteBtn {
  opacity: 0;
  background: none;
  border: none;
  font-size: 16px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0 var(--spacing-xs);
  transition: opacity var(--transition-fast);
}

.checkitemRow:hover .deleteBtn {
  opacity: 1;
}

.deleteBtn:hover {
  color: var(--color-danger);
}

.addBtn {
  background: none;
  border: none;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs) 0;
  transition: color var(--transition-fast);
}

.addBtn:hover {
  color: var(--color-text-primary);
}
</style>
