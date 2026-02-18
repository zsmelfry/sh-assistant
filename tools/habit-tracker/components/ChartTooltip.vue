<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="tooltip"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      {{ text }}
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  x: number;
  y: number;
  text: string;
}>();
</script>

<style scoped>
.tooltip {
  position: fixed;
  background: var(--color-text-primary);
  color: var(--color-accent-inverse);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 1000;
  transform: translate(-50%, -100%);
  margin-top: -8px;
}
</style>
