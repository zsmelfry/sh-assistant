<template>
  <nav class="viewNav">
    <button
      class="navTab"
      :class="{ active: currentType === 'overview' }"
      @click="$emit('navigate', { type: 'overview' })"
    >
      总览
    </button>
    <button
      class="navTab"
      :class="{ active: currentType === 'tags' }"
      @click="$emit('navigate', { type: 'tags' })"
    >
      标签
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { PlannerView } from '../types';

defineProps<{
  currentType: PlannerView['type'];
}>();

defineEmits<{
  navigate: [view: PlannerView];
}>();
</script>

<style scoped>
.viewNav {
  display: flex;
  gap: var(--spacing-xs);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-lg);
}

.navTab {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all var(--transition-fast);
}

.navTab:hover {
  color: var(--color-text-primary);
}

.navTab.active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-accent);
}

@media (max-width: 768px) {
  .navTab {
    min-height: var(--touch-target-min);
    flex: 1;
    text-align: center;
  }
  .navTab:active {
    color: var(--color-text-primary);
  }
}
</style>
