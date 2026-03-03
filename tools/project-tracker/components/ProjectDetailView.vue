<template>
  <div class="projectDetailView">
    <button class="backBtn" @click="$emit('back')">← 返回列表</button>
    <p class="placeholder">事项详情页（待实现） - ID: {{ projectId }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  projectId: number;
}>();

defineEmits<{
  back: [];
}>();
</script>

<style scoped>
.projectDetailView {
  padding: var(--spacing-lg);
}

.backBtn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs) 0;
  margin-bottom: var(--spacing-md);
}

.backBtn:hover {
  color: var(--color-text-primary);
}

.placeholder {
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--spacing-xl);
}
</style>
