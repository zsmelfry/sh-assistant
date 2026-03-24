<template>
  <div v-if="store.words.length > 0" class="batchBar">
    <button class="batchToggle" @click="showPanel = !showPanel">
      批量操作{{ store.someSelected ? ` (${store.selectedCount})` : '' }}
    </button>

    <div v-if="showPanel" class="batchPanel">
      <label class="selectAll">
        <input
          type="checkbox"
          class="checkbox"
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
