<template>
  <div class="globalProgress">
    <div class="statsRow">
      <div class="statItem">
        <span class="statValue">{{ totalGoals }}</span>
        <span class="statLabel">目标</span>
      </div>
      <div class="statItem">
        <span class="statValue">{{ completedCheckitems }}/{{ totalCheckitems }}</span>
        <span class="statLabel">检查项</span>
      </div>
      <div class="statItem">
        <span class="statValue">{{ completionRate }}%</span>
        <span class="statLabel">完成率</span>
      </div>
    </div>
    <div class="progressBar">
      <div class="progressFill" :style="{ width: completionRate + '%' }" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  totalGoals: number;
  totalCheckitems: number;
  completedCheckitems: number;
  completionRate: number;
}>();
</script>

<style scoped>
.globalProgress {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}

.statsRow {
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
}

.statItem {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.statValue {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.statLabel {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.progressBar {
  height: 6px;
  background-color: var(--color-chart-empty);
  border-radius: 3px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background-color: var(--color-accent);
  border-radius: 3px;
  transition: width var(--transition-fast);
}
</style>
