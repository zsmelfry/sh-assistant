<template>
  <BaseModal :open="open" title="管理分类" @close="$emit('close')">
    <div class="categoryManager">
      <div class="addForm">
        <input
          v-model="newName"
          type="text"
          placeholder="新分类名称"
          @keydown.enter="handleCreate"
        />
        <BaseButton :disabled="!newName.trim()" @click="handleCreate">添加</BaseButton>
      </div>

      <div class="categoryList">
        <div v-for="cat in categories" :key="cat.id" class="categoryItem">
          <template v-if="editingId === cat.id">
            <input
              v-model="editingName"
              type="text"
              @keydown.enter="handleUpdate"
              @keydown.escape="editingId = null"
            />
            <BaseButton size="sm" @click="handleUpdate">保存</BaseButton>
            <BaseButton size="sm" variant="ghost" @click="editingId = null">取消</BaseButton>
          </template>
          <template v-else>
            <span class="catName">{{ cat.name }}</span>
            <button class="iconBtn" @click="startEdit(cat)">✏️</button>
            <button class="iconBtn" @click="$emit('delete', cat.id)">&times;</button>
          </template>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton @click="$emit('close')">关闭</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import type { Category } from '../types';

defineProps<{
  open: boolean;
  categories: Category[];
}>();

const emit = defineEmits<{
  close: [];
  create: [name: string];
  update: [payload: { id: number; name: string }];
  delete: [id: number];
  reorder: [items: { id: number; sortOrder: number }[]];
}>();

const newName = ref('');
const editingId = ref<number | null>(null);
const editingName = ref('');

function handleCreate() {
  const name = newName.value.trim();
  if (!name) return;
  emit('create', name);
  newName.value = '';
}

function startEdit(cat: Category) {
  editingId.value = cat.id;
  editingName.value = cat.name;
}

function handleUpdate() {
  const name = editingName.value.trim();
  if (!name || editingId.value === null) return;
  emit('update', { id: editingId.value, name });
  editingId.value = null;
}
</script>

<style scoped>
.categoryManager {
  min-width: 300px;
}

.addForm {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.addForm input {
  flex: 1;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.categoryList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.categoryItem {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.categoryItem:hover {
  background: var(--color-bg-secondary);
}

.categoryItem input {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.catName {
  flex: 1;
}

.iconBtn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  opacity: 0.5;
}

.iconBtn:hover {
  opacity: 1;
}
</style>
