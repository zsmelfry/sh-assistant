<template>
  <span class="tagBadge">{{ name }}</span>
</template>

<script setup lang="ts">
defineProps<{
  name: string;
}>();
</script>

<style scoped>
.tagBadge {
  display: inline-block;
  padding: 2px var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
</style>
