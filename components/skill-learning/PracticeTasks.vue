<template>
  <div class="practiceTasks">
    <h3 class="sectionTitle">实践任务</h3>

    <!-- Loading -->
    <div v-if="store.tasksLoading" class="loadingState">加载中...</div>

    <!-- Generating -->
    <div v-else-if="store.tasksGenerating" class="loadingState">正在生成实践任务...</div>

    <!-- Task list -->
    <template v-else-if="store.tasks.length > 0">
      <div class="taskList">
        <TaskItem
          v-for="task in store.tasks"
          :key="task.id"
          :task="task"
          @update="handleUpdate"
        />
      </div>
    </template>

    <!-- No tasks — offer generate button -->
    <div v-else class="emptyTasks">
      <p class="emptyHint">该知识点暂无实践任务</p>
      <button class="generateBtn" @click="handleGenerate">
        生成任务
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import TaskItem from './TaskItem.vue';

const props = defineProps<{
  pointId: number;
}>();

const store = inject(SKILL_STORE_KEY)!;

onMounted(() => {
  store.loadTasks(props.pointId);
});

watch(() => props.pointId, (id) => {
  store.loadTasks(id);
});

function handleUpdate(taskId: number, data: { isCompleted: boolean; completionNote?: string }) {
  store.updateTask(taskId, data);
}

function handleGenerate() {
  store.generateTasks(props.pointId);
}
</script>

<style scoped>
.practiceTasks {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.loadingState {
  text-align: center;
  padding: var(--spacing-md);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.taskList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.emptyTasks {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

.emptyHint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.generateBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.generateBtn:hover {
  opacity: 0.85;
}
</style>
