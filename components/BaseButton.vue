<template>
  <button
    class="btn"
    :class="[`btn-${variant}`, { 'btn-disabled': disabled }]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}>(), {
  variant: 'primary',
  disabled: false,
});

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn-primary {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-ghost {
  background-color: transparent;
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.btn-danger {
  background-color: transparent;
  color: #DC2626;
  border-color: #DC2626;
}

.btn-danger:hover:not(:disabled) {
  background-color: #FEF2F2;
}

.btn-disabled,
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
