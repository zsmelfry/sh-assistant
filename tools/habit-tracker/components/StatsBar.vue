<template>
  <div class="statsBar">
    <div class="statItem">
      <span class="statValue">{{ streak }}</span>
      <span class="statLabel">{{ streakLabel }}</span>
    </div>
    <div class="statItem">
      <span class="statValue">{{ rateDisplay }}</span>
      <span class="statLabel">{{ rateLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HabitFrequency } from '../types';
import { STREAK_LABELS, RATE_LABELS } from '../types';

const props = defineProps<{
  streak: number;
  monthlyRate: number;
  frequency: HabitFrequency;
}>();

const streakLabel = computed(() => STREAK_LABELS[props.frequency]);
const rateLabel = computed(() => RATE_LABELS[props.frequency]);

const rateDisplay = computed(() => {
  if (props.frequency === 'monthly') {
    return props.monthlyRate >= 100 ? '已完成' : '未完成';
  }
  return `${props.monthlyRate}%`;
});
</script>

<style scoped>
.statsBar {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-md);
}

.statItem {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
}

.statValue {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.statLabel {
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>
