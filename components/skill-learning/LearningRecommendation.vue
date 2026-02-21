<template>
  <div class="learningRecommendation">
    <!-- Loading -->
    <div v-if="store.recommendationsLoading" class="loadingState">加载中...</div>

    <!-- All completed -->
    <div v-else-if="allCompleted" class="allDone">
      恭喜完成全部学习！
    </div>

    <!-- Recommendations -->
    <template v-else-if="store.recommendations.length > 0">
      <h3 class="sectionTitle">建议下一步学习</h3>
      <div class="recList">
        <div
          v-for="rec in store.recommendations"
          :key="rec.pointId"
          class="recItem"
          @click="store.navigateToPoint(rec.pointId)"
        >
          <div class="recInfo">
            <span class="recName">{{ rec.name }}</span>
            <span class="recMeta">
              {{ rec.domain.name }} / {{ rec.topic.name }}
              <template v-if="rec.stage"> · {{ rec.stage.name }}</template>
            </span>
          </div>
          <StatusBadge :status="rec.status" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import StatusBadge from './StatusBadge.vue';

const store = inject(SKILL_STORE_KEY)!;

const allCompleted = computed(() =>
  !store.recommendationsLoading
  && store.recommendations.length === 0
  && store.globalStats.totalPoints > 0
  && store.globalStats.completedCount >= store.globalStats.totalPoints,
);

onMounted(() => {
  store.loadRecommendations();
});
</script>

<style scoped>
.loadingState {
  text-align: center;
  padding: var(--spacing-sm);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.allDone {
  text-align: center;
  padding: var(--spacing-md);
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.sectionTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.recList {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.recItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.recItem:hover {
  background-color: var(--color-bg-hover);
}

.recItem:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.recInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.recName {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.recMeta {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .recItem {
    min-height: var(--touch-target-min);
  }
}
</style>
