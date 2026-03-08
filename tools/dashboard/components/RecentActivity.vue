<template>
  <div class="activity-card">
    <h3 class="card-title">最近动态</h3>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="activities.length === 0" class="empty">暂无活动记录</div>
    <ul v-else class="activity-list">
      <li v-for="item in activities" :key="item.id" class="activity-item">
        <span class="activity-date">{{ formatDate(item.date, item.createdAt) }}</span>
        <span class="activity-desc">{{ item.description }}</span>
        <span v-if="item.skillName" class="activity-skill">{{ item.skillName }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { ActivityItem } from '../types';

const activities = ref<ActivityItem[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    activities.value = await $fetch<ActivityItem[]>('/api/dashboard/activity?limit=8');
  } catch {
    // silently fail
  } finally {
    loading.value = false;
  }
});

function formatDate(date: string, createdAt: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const time = new Date(createdAt);
  const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

  if (date === today) return `今天 ${timeStr}`;
  if (date === yesterday) return `昨天 ${timeStr}`;
  return `${date.slice(5)} ${timeStr}`;
}
</script>

<style scoped>
.activity-card {
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-md);
}

.loading, .empty {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.activity-item {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
  font-size: 13px;
  padding: var(--spacing-xs) 0;
  border-bottom: 1px solid var(--color-border-light, var(--color-border));
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-date {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  min-width: 80px;
}

.activity-desc {
  flex: 1;
  color: var(--color-text-primary);
}

.activity-skill {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-secondary);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}
</style>
