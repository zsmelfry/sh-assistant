<template>
  <span class="statusBadge" :class="status">
    <Check v-if="status === 'practiced'" :size="12" />
    {{ POINT_STATUS_LABELS[status] }}
  </span>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { POINT_STATUS_LABELS } from '../types';
import type { PointStatus } from '../types';

defineProps<{
  status: PointStatus;
}>();
</script>

<style scoped>
.statusBadge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.4;
}

.statusBadge.not_started {
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  background: transparent;
}

.statusBadge.learning {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.statusBadge.understood {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.statusBadge.practiced {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}
</style>
