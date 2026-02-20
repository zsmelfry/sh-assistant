<template>
  <div class="tagManager">
    <div class="managerHeader">
      <h3 class="managerTitle">标签管理</h3>
      <button class="closeBtn" @click="$emit('close')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <!-- Create new tag -->
    <form class="createForm" @submit.prevent="handleCreate">
      <input
        v-model="newTagName"
        class="createInput"
        type="text"
        placeholder="新标签名称..."
      />
      <button
        class="colorPickerBtn"
        type="button"
        :style="{ backgroundColor: newTagColor }"
        @click="showColorPicker = !showColorPicker"
      />
      <button
        class="createBtn"
        type="submit"
        :disabled="!newTagName.trim() || creating"
      >
        添加
      </button>
    </form>

    <!-- Color picker for create -->
    <div v-if="showColorPicker" class="colorPalette">
      <button
        v-for="color in PRESET_COLORS"
        :key="color"
        class="colorSwatch"
        :class="{ selected: newTagColor === color }"
        :style="{ backgroundColor: color }"
        @click="newTagColor = color; showColorPicker = false"
      />
    </div>

    <div v-if="createError" class="errorMsg">{{ createError }}</div>

    <!-- Tag list -->
    <div class="tagList">
      <div v-if="store.tags.length === 0" class="emptyHint">还没有标签</div>

      <div
        v-for="tag in store.tags"
        :key="tag.id"
        class="tagRow"
      >
        <template v-if="editingId === tag.id">
          <input
            v-model="editName"
            class="editInput"
            @keydown.enter="saveEdit(tag.id)"
            @keydown.escape="cancelEdit"
          />
          <div class="editColorPalette">
            <button
              v-for="color in PRESET_COLORS"
              :key="color"
              class="colorSwatchSmall"
              :class="{ selected: editColor === color }"
              :style="{ backgroundColor: color }"
              @click="editColor = color"
            />
          </div>
          <div class="editActions">
            <button class="saveBtn" @click="saveEdit(tag.id)">保存</button>
            <button class="cancelBtn" @click="cancelEdit">取消</button>
          </div>
        </template>

        <template v-else>
          <span class="tagDot" :style="{ backgroundColor: tag.color || '#999' }" />
          <span class="tagRowName">{{ tag.name }}</span>
          <div class="tagRowActions">
            <button class="actionBtn" title="编辑" @click="startEdit(tag)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button class="actionBtn danger" title="删除" @click="handleDelete(tag.id)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tag } from '../types';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
  '#6B7280', '#000000',
];

defineEmits<{ close: [] }>();

const store = useArticleReaderStore();
const newTagName = ref('');
const newTagColor = ref(PRESET_COLORS[0]);
const showColorPicker = ref(false);
const creating = ref(false);
const createError = ref('');

const editingId = ref<number | null>(null);
const editName = ref('');
const editColor = ref('');

onMounted(() => {
  if (store.tags.length === 0) store.loadTags();
});

async function handleCreate() {
  const name = newTagName.value.trim();
  if (!name) return;
  creating.value = true;
  createError.value = '';
  try {
    await store.createTag(name, newTagColor.value);
    newTagName.value = '';
    newTagColor.value = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
  } catch (e: any) {
    createError.value = e?.data?.message || '创建失败';
  } finally {
    creating.value = false;
  }
}

function startEdit(tag: Tag) {
  editingId.value = tag.id;
  editName.value = tag.name;
  editColor.value = tag.color || '#999';
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(id: number) {
  const name = editName.value.trim();
  if (!name) return;
  try {
    await store.updateTag(id, { name, color: editColor.value });
    editingId.value = null;
  } catch (e: any) {
    createError.value = e?.data?.message || '更新失败';
  }
}

async function handleDelete(id: number) {
  await store.deleteTag(id);
}
</script>

<style scoped>
.tagManager {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
}

.managerHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.managerTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.closeBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.closeBtn:hover {
  background-color: var(--color-bg-hover);
}

/* Create form */
.createForm {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
}

.createInput {
  flex: 1;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  outline: none;
}

.createInput:focus {
  border-color: var(--color-accent);
}

.colorPickerBtn {
  width: 28px;
  height: 28px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
}

.createBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.createBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Color palette */
.colorPalette {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.colorSwatch {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.colorSwatch.selected {
  border-color: var(--color-text-primary);
  transform: scale(1.1);
}

.colorSwatch:hover {
  transform: scale(1.1);
}

.errorMsg {
  font-size: 12px;
  color: var(--color-danger);
}

/* Tag list */
.tagList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  max-height: 300px;
  overflow-y: auto;
}

.tagRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  flex-wrap: wrap;
}

.tagRow:hover {
  background-color: var(--color-bg-hover);
}

.tagDot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tagRowName {
  flex: 1;
  font-size: 14px;
  color: var(--color-text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tagRowActions {
  display: flex;
  gap: var(--spacing-xs);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.tagRow:hover .tagRowActions {
  opacity: 1;
}

.actionBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.actionBtn:hover {
  background-color: var(--color-bg-hover);
}

.actionBtn.danger:hover {
  color: var(--color-danger);
}

/* Edit mode */
.editInput {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-primary);
  outline: none;
}

.editInput:focus {
  border-color: var(--color-accent);
}

.editColorPalette {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  width: 100%;
}

.colorSwatchSmall {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
}

.colorSwatchSmall.selected {
  border-color: var(--color-text-primary);
}

.editActions {
  display: flex;
  gap: var(--spacing-xs);
  width: 100%;
}

.saveBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 12px;
  cursor: pointer;
}

.cancelBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.emptyHint {
  text-align: center;
  padding: var(--spacing-md);
  font-size: 13px;
  color: var(--color-text-disabled);
}
</style>
