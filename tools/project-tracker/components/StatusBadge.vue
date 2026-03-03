<template>
  <span class="statusBadge" :class="status">{{ STATUS_LABELS[status] }}</span>
</template>

<script setup lang="ts">
import type { ProjectStatus } from '../types';
import { STATUS_LABELS } from '../types';

defineProps<{
  status: ProjectStatus;
}>();
</script>

<style scoped>
.statusBadge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.idea {
  color: var(--color-text-secondary);
  border: 1px dashed var(--color-border);
}

.todo {
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.in_progress {
  color: var(--color-accent);
  background: var(--color-bg-hover);
  font-weight: 700;
}

.blocked {
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

.done {
  color: var(--color-success);
  background: var(--color-success-bg);
}

.dropped {
  color: var(--color-text-secondary);
  text-decoration: line-through;
}
</style>
