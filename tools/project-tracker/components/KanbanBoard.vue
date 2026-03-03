<template>
  <div class="kanbanBoard">
    <div class="kanbanColumns">
      <div v-for="status in KANBAN_STATUSES" :key="status" class="kanbanColumn">
        <div class="columnHeader">
          <StatusBadge :status="status" />
          <span class="columnCount">{{ columnProjects(status).length }}</span>
        </div>
        <div class="columnCards">
          <div
            v-for="p in columnProjects(status)"
            :key="p.id"
            class="kanbanCard"
            @click="$emit('open-project', p.id)"
          >
            <div class="cardTitle">{{ p.title }}</div>
            <div v-if="p.description" class="cardDesc">{{ p.description }}</div>
            <div class="cardMeta">
              <PriorityBadge v-if="p.priority !== 'medium'" :priority="p.priority" />
              <span v-if="p.dueDate" class="cardDue" :class="{ overdue: isOverdue(p.dueDate) }">
                {{ p.dueDate }}
              </span>
              <span v-if="p.checklistTotal > 0" class="cardProgress">
                {{ p.checklistDone }}/{{ p.checklistTotal }}
              </span>
            </div>
            <div v-if="p.tags.length" class="cardTags">
              <span v-for="tag in p.tags" :key="tag.id" class="cardTag">{{ tag.name }}</span>
            </div>
          </div>
          <div v-if="columnProjects(status).length === 0" class="columnEmpty">
            暂无事项
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProjectWithDetails, Category, Tag, ProjectStatus } from '../types';
import StatusBadge from './StatusBadge.vue';
import PriorityBadge from './PriorityBadge.vue';

const KANBAN_STATUSES: ProjectStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

const props = defineProps<{
  projects: ProjectWithDetails[];
  categories: Category[];
  tags: Tag[];
}>();

defineEmits<{
  'open-project': [id: number];
}>();

function columnProjects(status: ProjectStatus): ProjectWithDetails[] {
  return props.projects
    .filter(p => p.status === status)
    .sort((a, b) => {
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return a.sortOrder - b.sortOrder;
    });
}

function isOverdue(dueDate: string): boolean {
  return dueDate < new Date().toISOString().slice(0, 10);
}
</script>

<style scoped>
.kanbanBoard {
  overflow-x: auto;
  padding-bottom: var(--spacing-md);
}

.kanbanColumns {
  display: flex;
  gap: var(--spacing-md);
  min-width: min-content;
}

.kanbanColumn {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
}

.columnHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding-bottom: var(--spacing-xs);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-sm);
}

.columnCount {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
  padding: 0 6px;
  border-radius: var(--radius-sm);
  line-height: 1.6;
}

.columnCards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  overflow-y: auto;
  flex: 1;
}

.kanbanCard {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.kanbanCard:hover {
  background: var(--color-bg-hover);
}

.cardTitle {
  font-weight: 600;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.cardDesc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.cardMeta {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
  flex-wrap: wrap;
}

.cardDue {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.cardDue.overdue {
  color: var(--color-danger);
  font-weight: 600;
}

.cardProgress {
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
  padding: 0 4px;
  border-radius: 2px;
}

.cardTags {
  display: flex;
  gap: 2px;
  margin-top: var(--spacing-xs);
  flex-wrap: wrap;
}

.cardTag {
  font-size: 11px;
  padding: 0 4px;
  background: var(--color-bg-hover);
  border-radius: 2px;
  color: var(--color-text-secondary);
}

.columnEmpty {
  text-align: center;
  padding: var(--spacing-lg) var(--spacing-sm);
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
