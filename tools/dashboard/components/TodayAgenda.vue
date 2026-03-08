<template>
  <div class="agenda-card">
    <h3 class="card-title">今日待办</h3>
    <div v-if="!summary" class="loading">加载中...</div>
    <div v-else-if="items.length === 0" class="empty">今天没有待办事项</div>
    <ul v-else class="agenda-list">
      <li
        v-for="item in items"
        :key="item.key"
        class="agenda-item"
        :class="{ done: item.done }"
      >
        <NuxtLink :to="item.link" class="agenda-link">
          <span class="agenda-check">{{ item.done ? '✓' : '○' }}</span>
          <span class="agenda-text">{{ item.label }}</span>
          <span v-if="item.count" class="agenda-count">{{ item.count }}</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { DashboardSummary } from '../types';

const props = defineProps<{
  summary: DashboardSummary | null;
}>();

interface AgendaItem {
  key: string;
  label: string;
  done: boolean;
  link: string;
  count?: string;
}

const items = computed<AgendaItem[]>(() => {
  if (!props.summary) return [];
  const result: AgendaItem[] = [];

  // Habits not done today
  if (props.summary.habits) {
    const h = props.summary.habits;
    const pending = h.activeHabits.filter(hab => !hab.todayDone);
    if (pending.length > 0) {
      result.push({
        key: 'habits',
        label: `习惯打卡`,
        done: false,
        link: '/habit-tracker',
        count: `${h.todayCompleted}/${h.totalActive}`,
      });
    } else if (h.totalActive > 0) {
      result.push({
        key: 'habits',
        label: '习惯打卡 — 全部完成',
        done: true,
        link: '/habit-tracker',
      });
    }
  }

  // Vocab pending reviews
  if (props.summary.vocab && props.summary.vocab.pendingReviews > 0) {
    result.push({
      key: 'vocab',
      label: '法语词汇复习',
      done: false,
      link: '/vocab-tracker',
      count: `${props.summary.vocab.pendingReviews}个待复习`,
    });
  }

  // Planner incomplete checkitems
  if (props.summary.planner && props.summary.planner.totalCheckitems > props.summary.planner.completedCheckitems) {
    const remaining = props.summary.planner.totalCheckitems - props.summary.planner.completedCheckitems;
    result.push({
      key: 'planner',
      label: '年度计划',
      done: false,
      link: '/annual-planner',
      count: `${remaining}项待完成`,
    });
  }

  return result;
});
</script>

<style scoped>
.agenda-card {
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

.agenda-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.agenda-item {
  border-radius: var(--radius-sm);
}

.agenda-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
  text-decoration: none;
  color: var(--color-text-primary);
  font-size: 13px;
  transition: opacity var(--transition-fast);
}

.agenda-link:hover {
  opacity: 0.7;
}

.agenda-check {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.agenda-text {
  flex: 1;
}

.agenda-count {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.done .agenda-link {
  color: var(--color-text-secondary);
  text-decoration: line-through;
}
</style>
