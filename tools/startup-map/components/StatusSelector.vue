<template>
  <div class="statusSelector">
    <button
      v-for="s in STATUSES"
      :key="s"
      class="statusBtn"
      :class="{ active: status === s }"
      :disabled="disabled"
      @click="$emit('update:status', s)"
    >
      <Check v-if="s === 'practiced'" :size="12" />
      {{ POINT_STATUS_LABELS[s] }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { POINT_STATUS_LABELS } from '../types';
import type { PointStatus } from '../types';

const STATUSES: PointStatus[] = ['not_started', 'learning', 'understood', 'practiced'];

defineProps<{
  status: PointStatus;
  disabled?: boolean;
}>();

defineEmits<{
  'update:status': [status: PointStatus];
}>();
</script>

<style scoped>
.statusSelector {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.statusBtn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.statusBtn:not(:last-child) {
  border-right: 1px solid var(--color-border);
}

.statusBtn.active {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.statusBtn:hover:not(.active):not(:disabled) {
  background: var(--color-bg-hover);
}

.statusBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .statusBtn {
    padding: var(--spacing-xs) var(--spacing-xs);
    font-size: 11px;
    min-height: var(--touch-target-min);
  }
}
</style>
