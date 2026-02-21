<template>
  <div class="stageView">
    <!-- Loading -->
    <div v-if="store.stagesLoading" class="loadingState">
      加载中...
    </div>

    <!-- Empty -->
    <div v-else-if="store.stages.length === 0" class="emptyState">
      <p class="emptyTitle">还没有学习阶段数据</p>
      <p class="emptyHint">请先初始化种子数据</p>
    </div>

    <!-- Timeline -->
    <StageTimeline v-else :stages="store.stages" />
  </div>
</template>

<script setup lang="ts">
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import StageTimeline from './StageTimeline.vue';

const store = inject(SKILL_STORE_KEY)!;
</script>

<style scoped>
.stageView {
  display: flex;
  flex-direction: column;
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
</style>
