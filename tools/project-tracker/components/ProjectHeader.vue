<template>
  <div class="projectHeader">
    <div class="headerTop">
      <button class="backBtn" @click="$emit('back')">← 返回</button>
      <div class="headerActions">
        <button class="iconBtn" @click="$emit('edit')">编辑</button>
        <button class="iconBtn danger" @click="$emit('delete')">删除</button>
      </div>
    </div>

    <h1 class="projectTitle">{{ project.title }}</h1>

    <div class="metaRow">
      <StatusBadge :status="project.status" />
      <PriorityBadge :priority="project.priority" />
      <span class="categoryLabel">{{ project.categoryName }}</span>
      <span v-if="project.dueDate" class="dueDate" :class="{ overdue: isOverdue }">
        截止: {{ project.dueDate }}
      </span>
    </div>

    <div v-if="project.tags.length" class="tagRow">
      <span v-for="tag in project.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
    </div>

    <p v-if="project.description" class="description">{{ project.description }}</p>

    <div v-if="project.status === 'blocked' && project.blockedReason" class="blockedBanner">
      受阻原因: {{ project.blockedReason }}
    </div>

    <!-- Status quick-switch -->
    <div class="statusSwitch">
      <span class="label">状态:</span>
      <select :value="project.status" @change="handleStatusChange($event)">
        <option v-for="s in allStatuses" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProjectWithDetails, ProjectStatus } from '../types';
import { STATUS_LABELS } from '../types';
import StatusBadge from './StatusBadge.vue';
import PriorityBadge from './PriorityBadge.vue';

const allStatuses: ProjectStatus[] = ['idea', 'todo', 'in_progress', 'blocked', 'done', 'dropped'];

const props = defineProps<{
  project: ProjectWithDetails;
}>();

const emit = defineEmits<{
  back: [];
  edit: [];
  delete: [];
  'update-status': [status: ProjectStatus];
}>();

const isOverdue = computed(() => {
  if (!props.project.dueDate) return false;
  return props.project.dueDate < new Date().toISOString().slice(0, 10);
});

function handleStatusChange(e: Event) {
  emit('update-status', (e.target as HTMLSelectElement).value as ProjectStatus);
}
</script>

<style scoped>
.projectHeader {
  margin-bottom: var(--spacing-md);
}

.headerTop {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.backBtn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs) 0;
  font-size: 14px;
}

.backBtn:hover {
  color: var(--color-text-primary);
}

.headerActions {
  display: flex;
  gap: var(--spacing-sm);
}

.iconBtn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.iconBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.iconBtn.danger:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.projectTitle {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: var(--spacing-sm);
}

.metaRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
  flex-wrap: wrap;
}

.categoryLabel {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: 1px 6px;
  background: var(--color-bg-hover);
  border-radius: var(--radius-sm);
}

.dueDate {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.dueDate.overdue {
  color: var(--color-danger);
  font-weight: 600;
}

.tagRow {
  display: flex;
  gap: 4px;
  margin-bottom: var(--spacing-sm);
}

.tag {
  font-size: 12px;
  padding: 1px 6px;
  background: var(--color-bg-hover);
  border-radius: 2px;
  color: var(--color-text-secondary);
}

.description {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
  white-space: pre-wrap;
}

.blockedBanner {
  padding: var(--spacing-sm);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border-radius: var(--radius-sm);
  font-size: 13px;
  margin-bottom: var(--spacing-sm);
}

.statusSwitch {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
  border-top: 1px solid var(--color-border);
}

.statusSwitch .label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.statusSwitch select {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}
</style>
