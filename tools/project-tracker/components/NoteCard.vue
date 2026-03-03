<template>
  <div class="noteCard" @click="$emit('click')">
    <div class="cardHeader">
      <h4 class="noteTitle">{{ note.title }}</h4>
      <div class="cardActions" @click.stop>
        <button class="iconBtn" @click="$emit('delete')">&times;</button>
      </div>
    </div>
    <p v-if="note.aiSummary" class="aiSummary">{{ note.aiSummary }}</p>
    <p v-else-if="note.content" class="preview">{{ contentPreview }}</p>
    <div class="cardMeta">
      <span>{{ formatDate(note.updatedAt) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Note } from '../types';

const props = defineProps<{
  note: Note;
}>();

defineEmits<{
  click: [];
  delete: [];
}>();

const contentPreview = computed(() => {
  if (!props.note.content) return '';
  return props.note.content.slice(0, 150) + (props.note.content.length > 150 ? '...' : '');
});

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.noteCard {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.noteCard:hover {
  background: var(--color-bg-hover);
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.noteTitle {
  font-size: 14px;
  font-weight: 600;
}

.cardActions {
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.noteCard:hover .cardActions {
  opacity: 1;
}

.iconBtn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.5;
  padding: 2px 6px;
}

.iconBtn:hover {
  opacity: 1;
}

.aiSummary {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  font-style: italic;
  line-height: 1.4;
}

.preview {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  line-height: 1.4;
}

.cardMeta {
  margin-top: var(--spacing-xs);
  font-size: 11px;
  color: var(--color-text-disabled);
}
</style>
