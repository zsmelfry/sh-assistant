<template>
  <div class="logList">
    <div v-if="store.activitiesLoading" class="loadingState">加载中...</div>

    <template v-else-if="store.activities.length > 0">
      <div class="logItems">
        <div
          v-for="activity in store.activities"
          :key="activity.id"
          class="logItem"
        >
          <span class="logType">{{ ACTIVITY_TYPE_LABELS[activity.type] }}</span>
          <span
            v-if="activity.pointName"
            class="logPoint"
            @click="store.navigateToPoint(activity.pointId!)"
          >
            {{ activity.pointName }}
          </span>
          <span class="logTime">{{ formatTime(activity.createdAt) }}</span>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="store.activitiesTotalPages > 1" class="pagination">
        <button
          class="pageBtn"
          :disabled="store.activitiesPage <= 1"
          @click="changePage(store.activitiesPage - 1)"
        >
          上一页
        </button>
        <span class="pageInfo">{{ store.activitiesPage }} / {{ store.activitiesTotalPages }}</span>
        <button
          class="pageBtn"
          :disabled="store.activitiesPage >= store.activitiesTotalPages"
          @click="changePage(store.activitiesPage + 1)"
        >
          下一页
        </button>
      </div>
    </template>

    <div v-else class="emptyState">暂无学习记录</div>
  </div>
</template>

<script setup lang="ts">
import { ACTIVITY_TYPE_LABELS } from '../types';

const props = defineProps<{
  date?: string;
}>();

const store = useStartupMapStore();

onMounted(() => {
  store.loadActivities(1, props.date);
});

watch(() => props.date, (d) => {
  store.loadActivities(1, d);
});

function changePage(page: number) {
  store.loadActivities(page, props.date);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
</script>

<style scoped>
.loadingState,
.emptyState {
  text-align: center;
  padding: var(--spacing-md);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.logItems {
  display: flex;
  flex-direction: column;
}

.logItem {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
}

.logItem:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.logType {
  font-size: 13px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  min-width: 80px;
}

.logPoint {
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.logPoint:hover {
  text-decoration: underline;
}

.logTime {
  font-size: 12px;
  color: var(--color-text-disabled);
  flex-shrink: 0;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.pageBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.pageBtn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.pageBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pageInfo {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
