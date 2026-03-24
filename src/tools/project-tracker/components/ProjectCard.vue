<template>
  <div class="projectCard" :class="{ archived: project.archived }" @click="$emit('click')">
    <div class="cardMain">
      <div class="cardLeft">
        <span class="statusDot" :class="project.status" />
        <div class="cardInfo">
          <span class="cardTitle">{{ project.title }}</span>
          <div class="cardMeta">
            <StatusBadge :status="project.status" />
            <PriorityBadge v-if="project.priority !== 'medium'" :priority="project.priority" />
            <span v-if="project.dueDate" class="dueDate" :class="{ overdue: isOverdue }">
              {{ project.dueDate }}
            </span>
            <span v-if="project.tags.length" class="tagList">
              <span v-for="tag in project.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="cardRight">
        <div v-if="project.checklistTotal > 0" class="miniProgress">
          <div class="miniProgressBar">
            <div class="miniProgressFill" :style="{ width: progressPct + '%' }" />
          </div>
          <span class="miniProgressText">{{ project.checklistDone }}/{{ project.checklistTotal }}</span>
        </div>
        <select
          class="statusSelect"
          :value="project.status"
          @click.stop
          @change="handleStatusChange($event)"
        >
          <option v-for="s in allStatuses" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
        </select>
      </div>
    </div>
    <div v-if="project.status === 'blocked' && project.blockedReason" class="blockedReason">
      受阻: {{ project.blockedReason }}
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
  click: [];
  'update-status': [status: ProjectStatus];
}>();

const progressPct = computed(() => {
  if (props.project.checklistTotal === 0) return 0;
  return Math.round((props.project.checklistDone / props.project.checklistTotal) * 100);
});

const isOverdue = computed(() => {
  if (!props.project.dueDate) return false;
  return props.project.dueDate < new Date().toISOString().slice(0, 10);
});

function handleStatusChange(e: Event) {
  emit('update-status', (e.target as HTMLSelectElement).value as ProjectStatus);
}
</script>

<style scoped>
.projectCard {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.projectCard:hover {
  background: var(--color-bg-hover);
}

.projectCard.archived {
  opacity: 0.6;
}

.cardMain {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.cardLeft {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

.statusDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.statusDot.idea { background: var(--color-text-disabled); }
.statusDot.todo { background: var(--color-text-secondary); }
.statusDot.in_progress { background: var(--color-accent); }
.statusDot.blocked { background: var(--color-danger); }
.statusDot.done { background: var(--color-success); }
.statusDot.dropped { background: var(--color-text-disabled); }

.cardInfo {
  flex: 1;
  min-width: 0;
}

.cardTitle {
  display: block;
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cardMeta {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: 2px;
  flex-wrap: wrap;
}

.dueDate {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.dueDate.overdue {
  color: var(--color-danger);
  font-weight: 600;
}

.tagList {
  display: flex;
  gap: 2px;
}

.tag {
  font-size: 11px;
  padding: 0 4px;
  background: var(--color-bg-hover);
  border-radius: 2px;
  color: var(--color-text-secondary);
}

.cardRight {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.miniProgress {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.miniProgressBar {
  width: 48px;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}

.miniProgressFill {
  height: 100%;
  background: var(--color-accent);
  transition: width var(--transition-fast);
}

.miniProgressText {
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.statusSelect {
  padding: 2px 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
}

.blockedReason {
  margin-top: var(--spacing-xs);
  padding-left: 20px;
  font-size: 12px;
  color: var(--color-danger);
}

@media (max-width: 768px) {
  .miniProgress {
    display: none;
  }
}
</style>
