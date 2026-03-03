<template>
  <span class="priorityBadge" :class="priority">{{ PRIORITY_LABELS[priority] }}</span>
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
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
}

.high {
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

.medium {
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
}

.low {
  color: var(--color-text-disabled);
  background: var(--color-bg-hover);
}
</style>
