<template>
  <div class="diagramCard" @click="$emit('click')">
    <div class="cardHeader">
      <h4>{{ diagram.title }}</h4>
      <span class="diagramType">{{ diagram.type }}</span>
    </div>
    <p v-if="diagram.description" class="description">{{ diagram.description }}</p>
    <div class="cardActions" @click.stop>
      <button class="iconBtn" @click="$emit('delete')">&times;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Diagram } from '../types';

defineProps<{
  diagram: Diagram;
}>();

defineEmits<{
  click: [];
  delete: [];
}>();
</script>

<style scoped>
.diagramCard {
  position: relative;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.diagramCard:hover {
  background: var(--color-bg-hover);
}

.cardHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.cardHeader h4 {
  font-size: 14px;
  font-weight: 600;
}

.diagramType {
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}

.description {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.cardActions {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.diagramCard:hover .cardActions {
  opacity: 1;
}

.iconBtn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.5;
  padding: 2px 6px;
}

.iconBtn:hover {
  opacity: 1;
}
</style>
