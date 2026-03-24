<template>
  <div v-if="store.multiWordbookEnabled && store.wordbooks.length > 0" class="wordbookSelector">
    <div class="wordbookTabs">
      <button
        v-for="wb in store.wordbooks"
        :key="wb.id"
        class="wordbookTab"
        :class="{ active: wb.id === store.activeWordbookId }"
        @click="handleSwitch(wb.id)"
      >
        <span class="wordbookName">{{ wb.name }}</span>
        <span class="wordbookMeta">{{ languageLabel(wb.language) }} &middot; {{ wb.wordCount }}词</span>
      </button>

      <button class="wordbookTab addBtn" @click="showCreateForm = !showCreateForm">
        +
      </button>
    </div>

    <!-- Create form -->
    <div v-if="showCreateForm" class="createForm">
      <input
        v-model="newName"
        class="createInput"
        type="text"
        placeholder="词汇本名称"
        maxlength="100"
      />
      <select v-model="newLanguage" class="createSelect">
        <option v-for="lang in AVAILABLE_LANGUAGES" :key="lang.code" :value="lang.code">
          {{ lang.displayName }}
        </option>
      </select>
      <button
        class="createBtn"
        :disabled="!newName.trim() || isCreating"
        @click="handleCreate"
      >
        {{ isCreating ? '创建中...' : '创建' }}
      </button>
      <button class="cancelBtn" @click="showCreateForm = false">取消</button>
    </div>

    <!-- Delete button for non-active, non-sole wordbooks -->
    <div v-if="canDeleteAny" class="deleteRow">
      <button
        v-for="wb in deletableWordbooks"
        :key="wb.id"
        class="deleteBtn"
        @click="handleDelete(wb)"
      >
        删除「{{ wb.name }}」
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AVAILABLE_LANGUAGES, LANGUAGE_DISPLAY_MAP } from '../types';

const store = useVocabStore();

const showCreateForm = ref(false);
const newName = ref('');
const newLanguage = ref('fr');
const isCreating = ref(false);
const isSwitching = ref(false);

function languageLabel(code: string): string {
  return LANGUAGE_DISPLAY_MAP[code] ?? code;
}

const deletableWordbooks = computed(() =>
  store.wordbooks.filter(wb => !wb.isActive && store.wordbooks.length > 1),
);

const canDeleteAny = computed(() => deletableWordbooks.value.length > 0);

async function handleSwitch(id: number) {
  if (id === store.activeWordbookId || isSwitching.value) return;
  isSwitching.value = true;
  try {
    await store.switchWordbook(id);
  } finally {
    isSwitching.value = false;
  }
}

async function handleCreate() {
  if (!newName.value.trim() || isCreating.value) return;
  isCreating.value = true;
  try {
    await store.createWordbook(newName.value.trim(), newLanguage.value);
    newName.value = '';
    showCreateForm.value = false;
  } finally {
    isCreating.value = false;
  }
}

async function handleDelete(wb: { id: number; name: string }) {
  if (!confirm(`确定删除词汇本「${wb.name}」？该操作不可恢复。`)) return;
  try {
    await store.deleteWordbook(wb.id);
  } catch {
    alert('删除词汇本失败，请稍后重试。');
  }
}
</script>

<style scoped>
.wordbookSelector {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.wordbookTabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.wordbookTab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 13px;
}

.wordbookTab:hover:not(.active) {
  background-color: var(--color-bg-hover);
}

.wordbookTab.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.wordbookTab.active .wordbookMeta {
  color: var(--color-accent-inverse);
  opacity: 0.8;
}

.wordbookName {
  font-weight: 600;
  line-height: 1.3;
}

.wordbookMeta {
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.3;
}

.addBtn {
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 400;
  min-width: 36px;
  color: var(--color-text-secondary);
}

.createForm {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.createInput {
  flex: 1;
  min-width: 120px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  color: var(--color-text-primary);
  outline: none;
  transition: border-color var(--transition-fast);
}

.createInput:focus {
  border-color: var(--color-accent);
}

.createInput::placeholder {
  color: var(--color-text-tertiary);
}

.createSelect {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
}

.createSelect:focus {
  outline: none;
  border-color: var(--color-accent);
}

.createBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  cursor: pointer;
  transition: opacity var(--transition-fast);
  white-space: nowrap;
}

.createBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.createBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancelBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.cancelBtn:hover {
  background-color: var(--color-bg-hover);
}

.deleteRow {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.deleteBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.deleteBtn:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

@media (max-width: 768px) {
  .wordbookTab {
    min-height: var(--touch-target-min);
    justify-content: center;
  }

  .createForm {
    flex-direction: column;
    align-items: stretch;
  }

  .createBtn,
  .cancelBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
