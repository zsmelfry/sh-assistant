<template>
  <div class="projectFilters">
    <div class="filterRow">
      <!-- Status filter -->
      <select :value="statusValue" @change="handleStatusChange($event)">
        <option value="">全部状态</option>
        <option v-for="s in allStatuses" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
      </select>

      <!-- Category filter -->
      <select :value="filters.categoryId ?? ''" @change="handleCategoryChange($event)">
        <option value="">全部分类</option>
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
      </select>

      <!-- Search -->
      <input
        :value="filters.search"
        type="text"
        placeholder="搜索..."
        class="searchInput"
        @input="handleSearch($event)"
      />

      <!-- Archive toggle -->
      <label class="archiveToggle">
        <input
          type="checkbox"
          :checked="filters.showArchived"
          @change="$emit('update', { showArchived: ($event.target as HTMLInputElement).checked })"
        />
        显示归档
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProjectFilters, ProjectStatus, Category, Tag } from '../types';
import { STATUS_LABELS } from '../types';

const allStatuses: ProjectStatus[] = ['idea', 'todo', 'in_progress', 'blocked', 'done', 'dropped'];

const props = defineProps<{
  filters: ProjectFilters;
  categories: Category[];
  tags: Tag[];
}>();

const emit = defineEmits<{
  update: [filters: Partial<ProjectFilters>];
}>();

const statusValue = computed(() => props.filters.statuses[0] ?? '');

function handleStatusChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  emit('update', { statuses: val ? [val as ProjectStatus] : [] });
}

function handleCategoryChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  emit('update', { categoryId: val ? Number(val) : null });
}

let searchTimer: ReturnType<typeof setTimeout>;
function handleSearch(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    emit('update', { search: val });
  }, 300);
}
</script>

<style scoped>
.projectFilters {
  margin-bottom: var(--spacing-md);
}

.filterRow {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  flex-wrap: wrap;
}

.filterRow select,
.searchInput {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.searchInput {
  flex: 1;
  min-width: 120px;
}

.archiveToggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
}
</style>
