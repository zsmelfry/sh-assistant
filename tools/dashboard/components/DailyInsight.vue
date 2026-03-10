<template>
  <div v-if="insight || loading" class="insight-card">
    <p v-if="loading" class="insight-text insight-loading">小爽正在思考...</p>
    <p v-else class="insight-text">{{ insight }}</p>
    <div class="insight-footer">
      <span class="insight-label">小爽每日一言</span>
      <button class="refresh-btn" :disabled="loading" @click="fetchInsight(true)">换一句</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DailyInsight as DailyInsightType } from '../types';

const insight = ref('');
const loading = ref(false);

async function fetchInsight(refresh = false) {
  loading.value = true;
  try {
    const query = refresh ? '?refresh=1' : '';
    const data = await $fetch<DailyInsightType>(`/api/dashboard/insight${query}`);
    insight.value = data.content;
  } catch {
    // silently fail — insight is optional
  } finally {
    loading.value = false;
  }
}

onMounted(() => fetchInsight());
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

.insight-loading {
  color: var(--color-text-secondary);
}

.insight-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.insight-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.refresh-btn {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.refresh-btn:hover:not(:disabled) {
  color: var(--color-text-primary);
  border-color: var(--color-text-primary);
}

.refresh-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
