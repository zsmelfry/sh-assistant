<template>
  <div class="emptyState">
    <p class="emptyTitle">{{ title }}</p>
    <p class="emptyHint">{{ hint }}</p>
    <div class="emptyActions">
      <BaseButton v-if="actionLabel" @click="$emit('action')">
        {{ actionLabel }}
      </BaseButton>
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  hint: string;
  actionLabel?: string;
}>();

defineEmits<{
  action: [];
}>();
</script>

<style scoped>
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl) var(--spacing-lg);
  min-height: 300px;
}

.emptyTitle {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.emptyHint {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
}

.emptyActions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}
</style>
