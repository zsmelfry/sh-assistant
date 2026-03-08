<template>
  <div class="stats-card">
    <h3 class="card-title">数据概览</h3>
    <div v-if="!summary" class="loading">加载中...</div>
    <div v-else class="stats-grid">
      <div v-for="stat in stats" :key="stat.label" class="stat-item">
        <span class="stat-value">{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DashboardSummary } from '../types';

const props = defineProps<{
  summary: DashboardSummary | null;
}>();

interface StatItem {
  label: string;
  value: string;
}

const stats = computed<StatItem[]>(() => {
  if (!props.summary) return [];
  const result: StatItem[] = [];

  if (props.summary.habits) {
    const h = props.summary.habits;
    result.push({ label: '习惯完成', value: `${h.todayCompleted}/${h.totalActive}` });
    if (h.longestStreak > 0) result.push({ label: '最长连续', value: `${h.longestStreak}天` });
  }

  if (props.summary.vocab) {
    result.push({ label: '词汇量', value: `${props.summary.vocab.totalWords}` });
    if (props.summary.vocab.pendingReviews > 0) {
      result.push({ label: '待复习', value: `${props.summary.vocab.pendingReviews}` });
    }
  }

  if (props.summary.planner) {
    result.push({ label: '计划完成率', value: `${props.summary.planner.completionRate}%` });
  }

  if (props.summary.ability) {
    result.push({ label: '技能数', value: `${props.summary.ability.skills.length}` });
  }

  return result;
});
</script>

<style scoped>
.stats-card {
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

.loading {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
