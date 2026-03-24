<template>
  <div class="quickQuestions">
    <template v-if="loading">
      <div v-for="i in 3" :key="i" class="quickBtnSkeleton" />
    </template>
    <template v-else>
      <button
        v-for="btn in buttons"
        :key="btn.label"
        class="quickBtn"
        @click="$emit('select', btn.prompt)"
      >
        {{ btn.label }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { QuickButton } from '~/composables/skill-learning/types';

defineProps<{
  buttons: QuickButton[];
  loading?: boolean;
}>();

defineEmits<{
  select: [prompt: string];
}>();
</script>

<style scoped>
.quickQuestions {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
  padding: var(--spacing-xs) 0;
}

.quickBtn {
  padding: 4px var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quickBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-accent);
}

.quickBtnSkeleton {
  width: 64px;
  height: 26px;
  border-radius: 999px;
  background: var(--color-bg-hover);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
