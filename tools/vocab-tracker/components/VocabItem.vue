<template>
  <div class="vocabItem" :class="{ selected: isSelected }">
    <div class="topRow">
      <input
        type="checkbox"
        class="checkbox"
        :checked="isSelected"
        @change="toggleSelection"
      />
      <span class="rank">#{{ word.rank }}</span>
      <span class="word">{{ word.word }}</span>
    </div>

    <div class="bottomRow">
      <span class="status" :class="statusClass">
        {{ statusLabel }}
      </span>
      <button
        v-for="btn in actionButtons"
        :key="btn.action"
        class="actionBtn"
        @click="handleAction(btn.action)"
      >
        {{ btn.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WordWithProgress, StatusAction, LearningStatus } from '../types';
import { STATUS_LABELS } from '../types';

const props = defineProps<{
  word: WordWithProgress;
}>();

const store = useVocabStore();

const learningStatus = computed((): LearningStatus =>
  props.word.progress?.learningStatus ?? 'unread',
);

const isSelected = computed(() =>
  store.isSelected(props.word.id),
);

const statusLabel = computed(() => STATUS_LABELS[learningStatus.value]);

const statusClass = computed(() => `status-${learningStatus.value}`);

const actionButtons = computed(() => {
  switch (learningStatus.value) {
    case 'unread':
      return [
        { action: 'SET_TO_LEARN' as StatusAction, label: '待学习' },
        { action: 'SET_LEARNING' as StatusAction, label: '开始学习' },
        { action: 'SET_MASTERED' as StatusAction, label: '已掌握' },
      ];
    case 'to_learn':
      return [
        { action: 'SET_LEARNING' as StatusAction, label: '开始学习' },
        { action: 'SET_MASTERED' as StatusAction, label: '已掌握' },
      ];
    case 'learning':
      return [
        { action: 'SET_MASTERED' as StatusAction, label: '已掌握' },
      ];
    case 'mastered':
      return [
        { action: 'SET_LEARNING' as StatusAction, label: '返回学习' },
      ];
    default:
      return [];
  }
});

function toggleSelection() {
  store.toggleSelection(props.word.id);
}

function handleAction(action: StatusAction) {
  store.updateWordStatus(props.word.id, action);
}
</script>

<style scoped>
.vocabItem {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.vocabItem:hover {
  background-color: var(--color-bg-hover);
}

.vocabItem.selected {
  border-color: var(--color-accent);
  background-color: var(--color-bg-hover);
}

.topRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.rank {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: monospace;
}

.word {
  font-size: 15px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}

.bottomRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding-left: 24px;
}

.status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.status-unread {
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.status-to_learn {
  background-color: var(--color-chart-empty);
  color: var(--color-text-primary);
}

.status-learning {
  background-color: var(--color-text-secondary);
  color: var(--color-accent-inverse);
}

.status-mastered {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.actionBtn {
  padding: 2px var(--spacing-sm);
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.actionBtn:hover {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

@media (max-width: 768px) {
  .actionBtn {
    min-height: 32px;
    padding: var(--spacing-xs) var(--spacing-sm);
  }
  .actionBtn:active {
    background-color: var(--color-accent);
    color: var(--color-accent-inverse);
    border-color: var(--color-accent);
  }
}
</style>
