<template>
  <div class="practiceTasks">
    <button class="collapseHeader" @click="collapsed = !collapsed">
      <ChevronRight :size="16" class="chevron" :class="{ expanded: !collapsed }" />
      <h3 class="sectionTitle">实践任务</h3>
      <span v-if="completedCount > 0" class="badge">{{ completedCount }}/{{ store.tasks.length }}</span>
    </button>

    <template v-if="!collapsed">
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import TaskItem from './TaskItem.vue';

const props = defineProps<{
  pointId: number;
}>();

const store = inject(SKILL_STORE_KEY)!;
const collapsed = ref(false);

const completedCount = computed(() =>
  store.tasks.filter(t => t.isCompleted).length,
);

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

.collapseHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}

.chevron {
  transition: transform var(--transition-fast);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.badge {
  font-size: 11px;
  color: var(--color-text-secondary);
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
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
