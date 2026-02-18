<template>
  <div class="historyPanel">
    <button class="toggleBtn" @click="expanded = !expanded">
      {{ expanded ? '收起历史 ▴' : '查看历史 ▾' }}
    </button>

    <div v-if="expanded" class="panelContent">
      <!-- 热力图（所有频率都显示） -->
      <div class="section">
        <h4 class="sectionTitle">
          {{ frequency === 'daily' ? '年度打卡热力图' : frequency === 'weekly' ? '年度周完成情况' : '年度月完成情况' }}
        </h4>
        <HeatmapChart
          :habit-id="habitId"
          :frequency="frequency"
        />
      </div>

      <!-- 趋势图（daily 和 weekly 显示，monthly 不显示） -->
      <template v-if="frequency !== 'monthly'">
        <div class="divider" />
        <div class="section">
          <h4 class="sectionTitle">月度完成率趋势</h4>
          <TrendChart
            :habit-id="habitId"
            :frequency="frequency"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HabitFrequency } from '../types';
import HeatmapChart from './HeatmapChart.vue';
import TrendChart from './TrendChart.vue';

defineProps<{
  habitId: string;
  frequency: HabitFrequency;
}>();

const expanded = ref(true);
</script>

<style scoped>
.historyPanel {
  margin-top: var(--spacing-md);
}

.toggleBtn {
  background: none;
  border: none;
  padding: var(--spacing-xs) 0;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
  opacity: 0.6;
}

.toggleBtn:hover {
  opacity: 1;
}

.panelContent {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.section {
  margin-bottom: var(--spacing-md);
}

.section:last-child {
  margin-bottom: 0;
}

.sectionTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.divider {
  height: 1px;
  background-color: var(--color-border);
  margin: var(--spacing-md) 0;
}
</style>
