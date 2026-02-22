<template>
  <div class="iconPicker">
    <label class="label">图标</label>
    <div class="grid">
      <button
        v-for="name in AVAILABLE_ICONS"
        :key="name"
        type="button"
        class="iconBtn"
        :class="{ selected: modelValue === name }"
        :title="name"
        @click="$emit('update:modelValue', name)"
      >
        <component :is="resolveIcon(name)" :size="18" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AVAILABLE_ICONS, resolveIcon } from '~/utils/icon-map';

defineProps<{
  modelValue: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<style scoped>
.iconPicker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.iconBtn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.iconBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.iconBtn.selected {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}
</style>
