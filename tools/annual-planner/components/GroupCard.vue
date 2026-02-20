<template>
  <div class="groupCard">
    <div class="cardHeader">
      <h3 class="groupName">{{ name }}</h3>
      <span class="stat">{{ goalCount }} 个目标</span>
      <span class="stat">{{ Math.round(completionRate) }}%</span>
    </div>

    <div class="progressBar">
      <div class="progressFill" :style="{ width: completionRate + '%' }" />
    </div>

    <div v-if="goals.length > 0" class="goalList">
      <div
        v-for="goal in goals"
        :key="goal.id"
        class="goalRow"
      >
        <span class="goalTitle">{{ goal.title }}</span>
        <span v-if="goal.badge" class="badgeLabel">{{ goal.badge }}</span>
        <span class="goalRate">{{ Math.round(goal.completionRate) }}%</span>
      </div>
    </div>
    <p v-else class="emptyHint">{{ emptyText ?? '暂无目标' }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  name: string;
  goalCount: number;
  completionRate: number;
  goals: { id: number; title: string; badge?: string; completionRate: number }[];
  emptyText?: string;
}>();
</script>

<style scoped>
.groupCard {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
}

.cardHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.groupName {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.stat {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.progressBar {
  height: 4px;
  background-color: var(--color-chart-empty);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: var(--spacing-md);
}

.progressFill {
  height: 100%;
  background-color: var(--color-accent);
  border-radius: 2px;
  transition: width var(--transition-fast);
}

.goalList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.goalRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
}

.goalTitle {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-primary);
}

.badgeLabel {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 2px var(--spacing-sm);
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
}

.goalRate {
  font-size: 12px;
  color: var(--color-text-secondary);
  min-width: 32px;
  text-align: right;
}

.emptyHint {
  font-size: 13px;
  color: var(--color-text-disabled);
  text-align: center;
  padding: var(--spacing-sm);
}
</style>
