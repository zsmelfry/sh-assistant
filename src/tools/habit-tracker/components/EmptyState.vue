<template>
  <div class="emptyState">
    <p class="emptyText">还没有习惯</p>
    <p class="emptyHint">创建你的第一个习惯，开始打卡之旅</p>
    <BaseButton @click="$emit('create')">
      创建第一个习惯
    </BaseButton>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  create: [];
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

.emptyText {
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
</style>
