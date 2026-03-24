<template>
  <div class="greeting">
    <h1 class="greeting-text">{{ greeting }}</h1>
    <p v-if="streakText" class="streak-highlight">{{ streakText }}</p>
  </div>
</template>

<script setup lang="ts">
import type { DashboardSummary } from '../types';

const props = defineProps<{
  summary: DashboardSummary | null;
}>();

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了，注意休息';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const streakText = computed(() => {
  if (!props.summary?.habits) return '';
  const habits = props.summary.habits;
  if (habits.longestStreak <= 0) return '';

  // Find the habit with longest streak
  const best = habits.activeHabits.reduce(
    (max, h) => h.streak > max.streak ? h : max,
    { name: '', streak: 0, todayDone: false, id: '', frequency: '' },
  );
  if (best.streak > 0) {
    return `${best.name} 已经连续 ${best.streak} 天了，继续保持`;
  }
  return '';
});
</script>

<style scoped>
.greeting {
  padding: var(--spacing-lg) 0 0;
}

.greeting-text {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.streak-highlight {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: var(--spacing-xs) 0 0;
}
</style>
