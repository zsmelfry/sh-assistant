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
      <div v-if="currentStageName" class="statCard">
        <span class="statValue stageValue">{{ currentStageName }}</span>
        <span class="statLabel">当前阶段</span>
      </div>
    </div>

    <!-- Enhanced status breakdown -->
    <div v-if="store.enhancedStats" class="enhancedStats">
      <SegmentedProgress
        :not-started="store.enhancedStats.notStarted"
        :learning="store.enhancedStats.learning"
        :understood="store.enhancedStats.understood"
        :practiced="store.enhancedStats.practiced"
        :total="store.enhancedStats.totalPoints"
      />
      <div class="statusBreakdown">
        <span class="statusItem">已实践 {{ store.enhancedStats.practiced }}</span>
        <span class="statusItem">已理解 {{ store.enhancedStats.understood }}</span>
        <span class="statusItem">学习中 {{ store.enhancedStats.learning }}</span>
        <span class="statusItem">未开始 {{ store.enhancedStats.notStarted }}</span>
      </div>
    </div>

    <!-- Tab switch: 知识概览 / 学习热力图 -->
    <div class="viewTabs">
      <button
        class="viewTab"
        :class="{ active: store.globalTab === 'overview' }"
        @click="store.switchGlobalTab('overview')"
      >
        知识概览
      </button>
      <button
        class="viewTab"
        :class="{ active: store.globalTab === 'heatmap' }"
        @click="store.switchGlobalTab('heatmap')"
      >
        学习热力图
      </button>
    </div>

    <!-- Overview tab (merged domains + stages) -->
    <template v-if="store.globalTab === 'overview'">
      <!-- Loading -->
      <div v-if="store.domainsLoading" class="loadingState">
        加载中...
      </div>

      <!-- Empty state -->
      <div v-else-if="store.domains.length === 0" class="emptyState">
        <p class="emptyTitle">还没有知识树数据</p>
        <p class="emptyHint">导入内置知识树，包含 10 大领域、90+ 个知识点</p>
        <button
          class="seedBtn"
          :disabled="store.seeding"
          @click="store.seedData()"
        >
          {{ store.seeding ? '导入中...' : '导入知识树' }}
        </button>
      </div>

      <template v-else>
        <!-- Domain card grid -->
        <div class="domainGrid">
          <DomainCard
            v-for="domain in store.domains"
            :key="domain.id"
            :domain="domain"
            @click="store.navigateToDomain(domain.id)"
          />
        </div>

        <!-- Stage timeline -->
        <div v-if="store.stages.length > 0" class="stageSection">
          <h3 class="sectionTitle">学习阶段</h3>
          <StageTimeline :stages="store.stages" />
        </div>
      </template>
    </template>

    <!-- Heatmap tab -->
    <LearningHeatmap v-else-if="store.globalTab === 'heatmap'" />
  </div>
</template>

<script setup lang="ts">
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import DomainCard from './DomainCard.vue';
import StageTimeline from './StageTimeline.vue';
import SegmentedProgress from './SegmentedProgress.vue';
import LearningHeatmap from './LearningHeatmap.vue';

const store = inject(SKILL_STORE_KEY)!;

const currentStageName = computed(() => {
  const current = store.stages.find(s => s.isCurrent);
  return current?.name ?? null;
});

// Load stages and enhanced stats on mount
onMounted(() => {
  if (store.stages.length === 0) {
    store.loadStages();
  }
  store.loadEnhancedStats();
});
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

.statValue.stageValue {
  font-size: 16px;
}

/* Enhanced stats */
.enhancedStats {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.statusBreakdown {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.statusItem {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* View tabs */
.viewTabs {
  display: flex;
  gap: 2px;
  background: var(--color-bg-sidebar);
  border-radius: var(--radius-sm);
  padding: 2px;
  align-self: flex-start;
}

.viewTab {
  padding: var(--spacing-xs) var(--spacing-md);
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 3px;
  transition: all var(--transition-fast);
}

.viewTab.active {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.viewTab:hover:not(.active) {
  color: var(--color-text-primary);
}

/* Domain grid */
.domainGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

/* Stage section */
.stageSection {
  margin-top: var(--spacing-sm);
}

.sectionTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
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

.seedBtn {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.seedBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.seedBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  .viewTab {
    min-height: var(--touch-target-min);
    display: flex;
    align-items: center;
  }
}
</style>
