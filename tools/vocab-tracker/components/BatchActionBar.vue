<template>
  <div v-if="store.words.length > 0" class="batchBar">
    <button class="batchToggle" @click="showPanel = !showPanel">
      批量操作{{ store.someSelected ? ` (${store.selectedCount})` : '' }}
    </button>

    <div v-if="showPanel" class="batchPanel">
      <label class="selectAll">
        <input
          type="checkbox"
          :checked="allCurrentSelected"
          @change="toggleCurrentPage"
        />
        <span>当前页全选 ({{ store.words.length }})</span>
      </label>

      <div class="batchActions">
        <button
          class="batchBtn"
          :disabled="!store.someSelected"
          @click="handleBatch('SET_TO_LEARN')"
        >
          标记待学习
        </button>
        <button
          class="batchBtn"
          :disabled="!store.someSelected"
          @click="handleBatch('SET_LEARNING')"
        >
          标记学习中
        </button>
        <button
          class="batchBtn batchBtnPrimary"
          :disabled="!store.someSelected"
          @click="handleBatch('SET_MASTERED')"
        >
          标记已掌握
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StatusAction } from '../types';

const store = useVocabStore();
const showPanel = ref(false);

const allCurrentSelected = computed(() =>
  store.words.length > 0 && store.words.every(w => store.isSelected(w.id)),
);

function toggleCurrentPage() {
  if (allCurrentSelected.value) {
    store.clearSelection();
  } else {
    for (const w of store.words) {
      if (!store.isSelected(w.id)) {
        store.toggleSelection(w.id);
      }
    }
  }
}

async function handleBatch(action: StatusAction) {
  await store.batchUpdateStatus(action);
  showPanel.value = false;
}
</script>

<style scoped>
.batchBar {
  margin-top: var(--spacing-sm);
}

.batchToggle {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.batchToggle:hover {
  background-color: var(--color-bg-hover);
}

.batchPanel {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.selectAll {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  margin-bottom: var(--spacing-md);
}

.selectAll input {
  width: 16px;
  height: 16px;
  appearance: none;
  border: 1.5px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-bg-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.selectAll input:checked {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3E%3C/svg%3E");
  background-size: 12px;
  background-position: center;
  background-repeat: no-repeat;
}

.selectAll input:hover:not(:checked) {
  border-color: var(--color-text-secondary);
}

.batchActions {
  display: flex;
  gap: var(--spacing-sm);
}

.batchBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.batchBtn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.batchBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.batchBtnPrimary {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.batchBtnPrimary:hover:not(:disabled) {
  opacity: 0.85;
}
</style>
