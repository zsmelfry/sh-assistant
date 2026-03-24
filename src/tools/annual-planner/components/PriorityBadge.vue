<template>
  <span v-if="priority !== 'medium'" class="priorityBadge" :class="priority">
    {{ PRIORITY_LABELS[priority] }}
  </span>
</template>

<script setup lang="ts">
import type { Priority } from '../types';
import { PRIORITY_LABELS } from '../types';

defineProps<{
  priority: Priority;
}>();
</script>

<style scoped>
.priorityBadge {
  display: inline-block;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
}

.high {
  background-color: var(--color-text-primary);
  color: var(--color-accent-inverse);
}

.low {
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}
</style>
