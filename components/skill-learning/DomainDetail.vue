<template>
  <div class="domainDetail">
    <!-- Loading -->
    <div v-if="store.domainLoading" class="loadingState">
      加载中...
    </div>

    <template v-else-if="store.currentDomain">
      <!-- Header -->
      <div class="domainHeader">
        <div class="headerInfo">
          <h2 class="domainTitle">{{ store.currentDomain.name }}</h2>
          <p v-if="store.currentDomain.description" class="domainDesc">
            {{ store.currentDomain.description }}
          </p>
        </div>
        <span class="domainProgress">{{ completedCount }}/{{ totalPoints }} 已完成</span>
      </div>

      <!-- Status breakdown -->
      <div v-if="totalPoints > 0" class="domainStats">
        <SegmentedProgress
          :not-started="statusCounts.notStarted"
          :learning="statusCounts.learning"
          :understood="statusCounts.understood"
          :practiced="statusCounts.practiced"
          :total="totalPoints"
        />
        <div class="statusBreakdown">
          <span class="statusItem">已实践 {{ statusCounts.practiced }}</span>
          <span class="statusItem">已理解 {{ statusCounts.understood }}</span>
          <span class="statusItem">学习中 {{ statusCounts.learning }}</span>
          <span class="statusItem">未开始 {{ statusCounts.notStarted }}</span>
        </div>
      </div>

      <!-- Topic groups -->
      <div class="topicList">
        <div
          v-for="topic in store.currentDomain.topics"
          :key="topic.id"
          class="topicGroup"
        >
          <div class="topicHeader">
            <h3 class="topicTitle">{{ topic.name }}</h3>
            <p v-if="topic.description" class="topicDesc">{{ topic.description }}</p>
          </div>

          <div class="pointList">
            <div
              v-for="point in topic.points"
              :key="point.id"
              class="pointItem"
              @click="store.navigateToPoint(point.id)"
            >
              <span class="pointName">{{ point.name }}</span>
              <StatusBadge :status="point.status" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import StatusBadge from './StatusBadge.vue';
import SegmentedProgress from './SegmentedProgress.vue';

const store = inject(SKILL_STORE_KEY)!;

const allPoints = computed(() =>
  store.currentDomain?.topics.flatMap(t => t.points) ?? [],
);

const totalPoints = computed(() => allPoints.value.length);

const statusCounts = computed(() => {
  const points = allPoints.value;
  return {
    notStarted: points.filter(p => p.status === 'not_started').length,
    learning: points.filter(p => p.status === 'learning').length,
    understood: points.filter(p => p.status === 'understood').length,
    practiced: points.filter(p => p.status === 'practiced').length,
  };
});

const completedCount = computed(() =>
  statusCounts.value.understood + statusCounts.value.practiced,
);
</script>

<style scoped>
.domainDetail {
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

/* Header */
.domainHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.domainTitle {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.domainDesc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  line-height: 1.5;
}

.domainProgress {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* Topics */
.topicList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.topicGroup {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.topicHeader {
  padding: var(--spacing-md);
  background: var(--color-bg-sidebar);
}

.topicTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.topicDesc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

/* Points */
.pointList {
  display: flex;
  flex-direction: column;
}

.pointItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.pointItem:hover {
  background-color: var(--color-bg-hover);
}

.pointItem:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.pointName {
  font-size: 14px;
  color: var(--color-text-primary);
}

/* Domain stats */
.domainStats {
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

@media (max-width: 768px) {
  .domainHeader {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  .pointItem {
    min-height: var(--touch-target-min);
  }
}
</style>
