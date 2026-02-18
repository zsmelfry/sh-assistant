<template>
  <div class="statsPanel">
    <button
      v-for="item in statItems"
      :key="item.label"
      class="statCard"
      @click="navigateToFilter(item.filter)"
    >
      <span class="statLabel">{{ item.label }}</span>
      <span class="statValue">{{ item.value.toLocaleString() }}</span>
      <span v-if="item.percent !== undefined" class="statPercent">
        {{ item.percent }}%
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { FilterType } from '../types';

const store = useVocabStore();

const progressPercent = computed(() => {
  if (store.stats.total === 0) return 0;
  return Math.round(((store.stats.learning + store.stats.mastered) / store.stats.total) * 100);
});

const masteredPercent = computed(() => {
  if (store.stats.total === 0) return 0;
  return Math.round((store.stats.mastered / store.stats.total) * 100);
});

const statItems = computed(() => [
  { label: '总词数', value: store.stats.total, filter: 'all' as FilterType },
  { label: '未读', value: store.stats.unread, filter: 'unread' as FilterType },
  { label: '待学习', value: store.stats.toLearn, filter: 'toLearn' as FilterType },
  { label: '正在学习', value: store.stats.learning, filter: 'learning' as FilterType, percent: progressPercent.value },
  { label: '已掌握', value: store.stats.mastered, filter: 'mastered' as FilterType, percent: masteredPercent.value },
]);

function navigateToFilter(f: FilterType) {
  store.setFilter(f);
}
</script>

<style scoped>
.statsPanel {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}

@media (min-width: 768px) {
  .statsPanel {
    grid-template-columns: repeat(5, 1fr);
  }
}

.statCard {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  text-align: left;
}

.statCard:hover {
  background-color: var(--color-bg-hover);
}

.statLabel {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.statValue {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.statPercent {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}
</style>
