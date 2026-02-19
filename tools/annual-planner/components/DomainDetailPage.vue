<template>
  <div class="domainDetailPage">
    <div class="pageHeader">
      <button class="backBtn" @click="$emit('back')">← 返回总览</button>
      <h2 class="domainName">{{ domain.name }}</h2>
      <div class="headerRight">
        <span class="stat">
          {{ domain.completedCheckitems }}/{{ domain.totalCheckitems }} 检查项
          ({{ Math.round(domain.completionRate) }}%)
        </span>
        <BaseButton @click="$emit('createGoal')">添加目标</BaseButton>
      </div>
    </div>

    <EmptyState
      v-if="goals.length === 0"
      title="还没有目标"
      hint="在这个领域添加你的第一个年度目标"
      action-label="添加目标"
      @action="$emit('createGoal')"
    />

    <div v-else class="goalList">
      <GoalCard
        v-for="goal in goals"
        :key="goal.id"
        :goal="goal"
        :show-checkitem-input="activeCheckitemGoalId === goal.id"
        @edit="$emit('editGoal', goal)"
        @delete="$emit('deleteGoal', goal)"
        @dragstart="onGoalDragStart($event, goal.id)"
        @dragover="onGoalDragOver($event)"
        @drop="onGoalDrop($event, goal.id)"
        @toggle-checkitem="$emit('toggleCheckitem', $event)"
        @delete-checkitem="$emit('deleteCheckitem', $event)"
        @add-checkitem="handleAddCheckitem(goal.id, $event)"
        @show-checkitem-input="activeCheckitemGoalId = goal.id"
        @hide-checkitem-input="activeCheckitemGoalId = null"
        @update-checkitem="(id: number, content: string) => $emit('updateCheckitem', id, content)"
        @reorder-checkitems="$emit('reorderCheckitems', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DomainWithStats, GoalWithDetails } from '../types';
import GoalCard from './GoalCard.vue';
import EmptyState from './EmptyState.vue';

const isMobile = useIsMobile();

const props = defineProps<{
  domain: DomainWithStats;
  goals: GoalWithDetails[];
}>();

const emit = defineEmits<{
  back: [];
  createGoal: [];
  editGoal: [goal: GoalWithDetails];
  deleteGoal: [goal: GoalWithDetails];
  reorderGoals: [items: { id: number; sortOrder: number }[]];
  toggleCheckitem: [id: number];
  deleteCheckitem: [id: number];
  addCheckitem: [goalId: number, content: string];
  updateCheckitem: [id: number, content: string];
  reorderCheckitems: [items: { id: number; sortOrder: number }[]];
}>();

const activeCheckitemGoalId = ref<number | null>(null);

function handleAddCheckitem(goalId: number, content: string) {
  emit('addCheckitem', goalId, content);
}

// Goal drag & drop
const dragGoalId = ref<number | null>(null);

function onGoalDragStart(e: DragEvent, id: number) {
  if (isMobile.value) return;
  dragGoalId.value = id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
}

function onGoalDragOver(e: DragEvent) {
  if (isMobile.value) return;
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
}

function onGoalDrop(_e: DragEvent, targetId: number) {
  if (isMobile.value) return;
  if (dragGoalId.value === null || dragGoalId.value === targetId) return;

  const items = [...props.goals];
  const dragIdx = items.findIndex(g => g.id === dragGoalId.value);
  const targetIdx = items.findIndex(g => g.id === targetId);
  if (dragIdx === -1 || targetIdx === -1) return;

  const [moved] = items.splice(dragIdx, 1);
  items.splice(targetIdx, 0, moved);

  const reordered = items.map((item, i) => ({ id: item.id, sortOrder: i }));
  emit('reorderGoals', reordered);
  dragGoalId.value = null;
}
</script>

<style scoped>
.domainDetailPage {
  padding: var(--spacing-lg);
}

.pageHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.backBtn {
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.backBtn:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-hover);
}

.domainName {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  flex: 1;
}

.headerRight {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.stat {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.goalList {
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .domainDetailPage {
    padding: var(--spacing-md);
  }
  .pageHeader {
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }
  .domainName {
    font-size: 18px;
    flex-basis: 100%;
    order: -1;
  }
  .backBtn {
    min-height: var(--touch-target-min);
  }
  .headerRight {
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }
}
</style>
