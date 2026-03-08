<template>
  <div v-if="insight" class="insight-card">
    <p class="insight-text">{{ insight }}</p>
    <span class="insight-label">小爽每日一言</span>
  </div>
</template>

<script setup lang="ts">
import type { DailyInsight as DailyInsightType } from '../types';

const insight = ref('');

onMounted(async () => {
  try {
    const data = await $fetch<DailyInsightType>('/api/dashboard/insight');
    insight.value = data.content;
  } catch {
    // silently fail — insight is optional
  }
});
</script>

<style scoped>
.insight-card {
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.insight-text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-xs);
}

.insight-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
