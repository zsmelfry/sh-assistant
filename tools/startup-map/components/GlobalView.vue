<template>
  <div class="globalView">
    <!-- Global stats bar -->
    <div class="statsBar">
      <div class="statCard">
        <span class="statValue">{{ store.globalStats.totalPoints }}</span>
        <span class="statLabel">总知识点</span>
      </div>
      <div class="statCard">
        <span class="statValue">{{ store.globalStats.completedCount }}</span>
        <span class="statLabel">已完成</span>
      </div>
      <div class="statCard">
        <span class="statValue">{{ store.globalStats.completionRate }}%</span>
        <span class="statLabel">完成率</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.domainsLoading" class="loadingState">
      加载中...
    </div>

    <!-- Empty state -->
    <div v-else-if="store.domains.length === 0" class="emptyState">
      <p class="emptyTitle">还没有知识树数据</p>
      <p class="emptyHint">请先初始化种子数据</p>
    </div>

    <!-- Domain card grid -->
    <div v-else class="domainGrid">
      <DomainCard
        v-for="domain in store.domains"
        :key="domain.id"
        :domain="domain"
        @click="store.navigateToDomain(domain.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import DomainCard from './DomainCard.vue';

const store = useStartupMapStore();
</script>

<style scoped>
.globalView {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.statsBar {
  display: flex;
  gap: var(--spacing-md);
}

.statCard {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.statValue {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.statLabel {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.domainGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.loadingState {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  font-size: 14px;
}

.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  gap: var(--spacing-sm);
}

.emptyTitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.emptyHint {
  font-size: 14px;
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .statsBar {
    gap: var(--spacing-sm);
  }
  .statCard {
    padding: var(--spacing-sm);
  }
  .statValue {
    font-size: 20px;
  }
  .domainGrid {
    grid-template-columns: 1fr;
  }
}
</style>
