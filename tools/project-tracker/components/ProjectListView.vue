<template>
  <div class="projectListView">
    <div class="listHeader">
      <h2>事项追踪</h2>
      <div class="headerActions">
        <BaseButton @click="$emit('create-project')">+ 新事项</BaseButton>
        <BaseButton variant="ghost" @click="$emit('manage-categories')">管理分类</BaseButton>
      </div>
    </div>
    <p class="placeholder">列表视图（待实现）</p>
  </div>
</template>

<script setup lang="ts">
import type { ProjectWithDetails, Category, Tag, ProjectFilters } from '../types';

defineProps<{
  projects: ProjectWithDetails[];
  categories: Category[];
  tags: Tag[];
  filters: ProjectFilters;
}>();

defineEmits<{
  'open-project': [id: number];
  'create-project': [];
  'manage-categories': [];
  'update-filters': [filters: Partial<ProjectFilters>];
  'update-status': [projectId: number, status: string];
}>();
</script>

<style scoped>
.projectListView {
  padding: var(--spacing-lg);
}

.listHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
}

.listHeader h2 {
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.headerActions {
  display: flex;
  gap: var(--spacing-sm);
}

.placeholder {
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--spacing-xl);
}
</style>
