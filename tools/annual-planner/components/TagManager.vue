<template>
  <BaseModal
    :open="open"
    title="标签管理"
    max-width="400px"
    @close="$emit('close')"
  >
    <div class="tagManager">
      <div class="createRow">
        <input
          v-model="newTagName"
          class="tagInput"
          type="text"
          placeholder="输入标签名称..."
          @keydown.enter="handleCreate"
        />
        <BaseButton
          :disabled="!newTagName.trim()"
          @click="handleCreate"
        >
          新建
        </BaseButton>
      </div>

      <div v-if="tags.length === 0" class="emptyHint">
        还没有标签
      </div>

      <div v-else class="tagList">
        <div v-for="tag in tags" :key="tag.id" class="tagRow">
          <span
            v-if="editingId !== tag.id"
            class="tagName"
            @dblclick="startEdit(tag)"
          >
            {{ tag.name }}
          </span>
          <input
            v-else
            ref="editInputRef"
            v-model="editName"
            class="tagInput editInput"
            type="text"
            @keydown.enter="commitEdit(tag.id)"
            @keydown.escape="cancelEdit"
            @blur="commitEdit(tag.id)"
          />
          <button class="deleteBtn" @click="handleDelete(tag)">
            &times;
          </button>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import type { PlannerTag } from '../types';

const props = defineProps<{
  open: boolean;
  tags: PlannerTag[];
}>();

const emit = defineEmits<{
  close: [];
  create: [name: string];
  update: [id: number, name: string];
  delete: [id: number];
}>();

const newTagName = ref('');
const editingId = ref<number | null>(null);
const editName = ref('');
const editInputRef = ref<HTMLInputElement[] | null>(null);

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    newTagName.value = '';
    cancelEdit();
  }
});

function handleCreate() {
  const trimmed = newTagName.value.trim();
  if (!trimmed) return;
  emit('create', trimmed);
  newTagName.value = '';
}

function startEdit(tag: PlannerTag) {
  editingId.value = tag.id;
  editName.value = tag.name;
  nextTick(() => {
    if (editInputRef.value?.[0]) {
      editInputRef.value[0].focus();
    }
  });
}

function commitEdit(id: number) {
  const trimmed = editName.value.trim();
  if (trimmed && trimmed !== props.tags.find(t => t.id === id)?.name) {
    emit('update', id, trimmed);
  }
  cancelEdit();
}

function cancelEdit() {
  editingId.value = null;
  editName.value = '';
}

function handleDelete(tag: PlannerTag) {
  emit('delete', tag.id);
}
</script>

<style scoped>
.tagManager {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.createRow {
  display: flex;
  gap: var(--spacing-sm);
}

.tagInput {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.tagInput:focus {
  border-color: var(--color-accent);
}

.emptyHint {
  text-align: center;
  font-size: 14px;
  color: var(--color-text-secondary);
  padding: var(--spacing-md);
}

.tagList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.tagRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.tagRow:hover {
  background-color: var(--color-bg-hover);
}

.tagName {
  flex: 1;
  font-size: 14px;
  cursor: default;
}

.editInput {
  flex: 1;
}

.deleteBtn {
  background: none;
  border: none;
  font-size: 16px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0 var(--spacing-xs);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.tagRow:hover .deleteBtn {
  opacity: 1;
}

.deleteBtn:hover {
  color: var(--color-danger);
}
</style>
