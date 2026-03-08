<template>
  <div class="dashboard">
    <GreetingBanner :summary="summary" />

    <ClaimableMilestones />

    <DailyInsight />

    <div class="dashboard-grid">
      <TodayAgenda :summary="summary" />
      <QuickStats :summary="summary" />
    </div>

    <RecentActivity />
  </div>
</template>

<script setup lang="ts">
import GreetingBanner from './components/GreetingBanner.vue';
import ClaimableMilestones from './components/ClaimableMilestones.vue';
import DailyInsight from './components/DailyInsight.vue';
import TodayAgenda from './components/TodayAgenda.vue';
import QuickStats from './components/QuickStats.vue';
import RecentActivity from './components/RecentActivity.vue';
import type { DashboardSummary } from './types';

const summary = ref<DashboardSummary | null>(null);

onMounted(async () => {
  try {
    summary.value = await $fetch<DashboardSummary>('/api/dashboard/summary');
  } catch {
    // silently fail
  }
});
</script>

<style scoped>
.dashboard {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
