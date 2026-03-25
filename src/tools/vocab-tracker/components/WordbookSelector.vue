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

      <button class="wordbookTab addBtn" @click="$emit('create')">
        +
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LANGUAGE_DISPLAY_MAP } from '../types';

defineEmits<{ create: [] }>();

const store = useVocabStore();
const isSwitching = ref(false);

function languageLabel(code: string): string {
  return LANGUAGE_DISPLAY_MAP[code] ?? code;
}

async function handleSwitch(id: number) {
  if (id === store.activeWordbookId || isSwitching.value) return;
  isSwitching.value = true;
  try {
    await store.switchWordbook(id);
  } finally {
    isSwitching.value = false;
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

@media (max-width: 768px) {
  .wordbookTab {
    min-height: var(--touch-target-min);
    justify-content: center;
  }
}
</style>
