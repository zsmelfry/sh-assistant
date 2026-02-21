<template>
  <div class="learningHeatmap">
    <!-- Streak display -->
    <div class="streakBar">
      <span class="streakValue">{{ store.currentStreak }}</span>
      <span class="streakLabel">天连续学习</span>
    </div>

    <!-- Heatmap grid -->
    <HeatmapGrid
      :year="store.heatmapYear"
      :data="store.heatmapData"
      @change-year="handleYearChange"
      @select-date="handleDateSelect"
    />

    <!-- Day detail -->
    <div v-if="selectedDate" class="dayDetail">
      <div class="dayDetailHeader">
        <span class="dayDetailDate">{{ selectedDate }} 的学习记录</span>
        <button class="clearDate" @click="selectedDate = null">关闭</button>
      </div>
      <LearningLogList :date="selectedDate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import HeatmapGrid from './HeatmapGrid.vue';
import LearningLogList from './LearningLogList.vue';

const store = useStartupMapStore();
const selectedDate = ref<string | null>(null);

onMounted(() => {
  store.loadHeatmap();
  store.loadStreak();
});

function handleYearChange(year: number) {
  store.loadHeatmap(year);
}

function handleDateSelect(date: string) {
  selectedDate.value = selectedDate.value === date ? null : date;
}
</script>

<style scoped>
.learningHeatmap {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.streakBar {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-xs);
}

.streakValue {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.streakLabel {
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* Day detail */
.dayDetail {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.dayDetailHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-sidebar);
}

.dayDetailDate {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.clearDate {
  border: none;
  background: none;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  text-decoration: underline;
}

.clearDate:hover {
  color: var(--color-text-primary);
}
</style>
