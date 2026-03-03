<template>
  <div class="tabNav">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tabBtn"
      :class="{ active: modelValue === tab.id }"
      @click="$emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}
      <span v-if="tab.count !== undefined" class="tabCount">{{ tab.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tabs: { id: string; label: string; count?: number }[];
  modelValue: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<style scoped>
.tabNav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-md);
}

.tabBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.tabBtn:hover {
  color: var(--color-text-primary);
}

.tabBtn.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
  font-weight: 600;
}

.tabCount {
  margin-left: 4px;
  font-size: 11px;
  background: var(--color-bg-hover);
  padding: 1px 5px;
  border-radius: 8px;
}

.tabBtn.active .tabCount {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}
</style>
