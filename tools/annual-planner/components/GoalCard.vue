<template>
  <div
    class="goalCard"
    :class="{
      completed: isFullyCompleted,
      stagnant: goal.isStagnant && !isFullyCompleted,
    }"
    :draggable="!isMobile"
    @dragstart="$emit('dragstart', $event)"
    @dragover.prevent="$emit('dragover', $event)"
    @drop="$emit('drop', $event)"
  >
    <div class="cardHeader">
      <div class="titleRow">
        <h4 class="goalTitle" :class="{ strikethrough: isFullyCompleted }">
          {{ goal.title }}
        </h4>
        <PriorityBadge :priority="goal.priority" />
        <StagnantBadge v-if="goal.isStagnant && !isFullyCompleted" />
        <span v-if="isFullyCompleted" class="completedMark">已完成</span>
      </div>
      <div class="actions">
        <button class="actionBtn" title="编辑" @click.stop="$emit('edit')">
          ✏️
        </button>
        <button class="actionBtn" title="删除" @click.stop="$emit('delete')">
          &times;
        </button>
      </div>
    </div>

    <p v-if="goal.description" class="description">{{ goal.description }}</p>

    <div v-if="goal.tags.length > 0" class="tagList">
      <TagBadge v-for="tag in goal.tags" :key="tag.id" :name="tag.name" />
    </div>

    <div class="progressRow">
      <div class="progressBar">
        <div class="progressFill" :style="{ width: progressPercent + '%' }" />
      </div>
      <span class="progressText">
        {{ goal.completedCheckitems }}/{{ goal.totalCheckitems }}
      </span>
    </div>

    <CheckitemList
      :checkitems="goal.checkitems"
      :show-input="showCheckitemInput"
      @toggle="$emit('toggleCheckitem', $event)"
      @delete="$emit('deleteCheckitem', $event)"
      @add="$emit('addCheckitem', $event)"
      @show-input="$emit('showCheckitemInput')"
      @hide-input="$emit('hideCheckitemInput')"
      @update="(id: number, content: string) => $emit('updateCheckitem', id, content)"
      @reorder="$emit('reorderCheckitems', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { GoalWithDetails } from '../types';

const isMobile = useIsMobile();
import PriorityBadge from './PriorityBadge.vue';
import StagnantBadge from './StagnantBadge.vue';
import TagBadge from './TagBadge.vue';
import CheckitemList from './CheckitemList.vue';

const props = defineProps<{
  goal: GoalWithDetails;
  showCheckitemInput: boolean;
}>();

defineEmits<{
  edit: [];
  delete: [];
  dragstart: [e: DragEvent];
  dragover: [e: DragEvent];
  drop: [e: DragEvent];
  toggleCheckitem: [id: number];
  deleteCheckitem: [id: number];
  addCheckitem: [content: string];
  showCheckitemInput: [];
  hideCheckitemInput: [];
  updateCheckitem: [id: number, content: string];
  reorderCheckitems: [items: { id: number; sortOrder: number }[]];
}>();

const isFullyCompleted = computed(() =>
  props.goal.totalCheckitems > 0 && props.goal.completedCheckitems === props.goal.totalCheckitems,
);

const progressPercent = computed(() => {
  if (props.goal.totalCheckitems === 0) return 0;
  return Math.round((props.goal.completedCheckitems / props.goal.totalCheckitems) * 100);
});
</script>

<style scoped>
.goalCard {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: grab;
  transition: all var(--transition-fast);
}

.goalCard:active {
  cursor: grabbing;
}

.goalCard.completed {
  opacity: 0.7;
}

.goalCard.stagnant {
  border-left: 3px solid var(--color-warning);
}

.cardHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--spacing-xs);
}

.titleRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.goalTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.goalTitle.strikethrough {
  text-decoration: line-through;
}

.completedMark {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-success);
  background-color: var(--color-success-bg);
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.actions {
  display: flex;
  gap: var(--spacing-xs);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.goalCard:hover .actions {
  opacity: 1;
}

.actionBtn {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  padding: 2px var(--spacing-xs);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
}

.actionBtn:hover {
  background-color: var(--color-bg-hover);
}

.description {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.tagList {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.progressRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.progressBar {
  flex: 1;
  height: 4px;
  background-color: var(--color-chart-empty);
  border-radius: 2px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background-color: var(--color-accent);
  border-radius: 2px;
  transition: width var(--transition-fast);
}

.progressText {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .goalCard {
    cursor: default;
    -webkit-user-drag: none;
  }
  .actions {
    opacity: 1;
  }
  .actionBtn {
    min-width: var(--touch-target-min);
    min-height: var(--touch-target-min);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .actionBtn:active {
    background-color: var(--color-bg-hover);
  }
}
</style>
