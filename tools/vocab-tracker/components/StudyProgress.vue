<template>
  <div class="progressPanel">
    <!-- Progress -->
    <div class="progressCard">
      <span class="progressLabel">进度</span>
      <div class="progressBarOuter">
        <div
          class="progressBarInner"
          :style="{ '--progress': `${progress.percentage}%` }"
        ></div>
      </div>
      <span class="progressText">{{ progress.current }}/{{ progress.total }}</span>
    </div>

    <!-- Stats -->
    <div class="statsCard">
      <div class="statItem">
        <span class="statValue statNew">{{ studyStore.sessionNewWords }}</span>
        <span class="statLabel">新词</span>
      </div>
      <div class="statItem">
        <span class="statValue statReview">{{ studyStore.sessionReviews }}</span>
        <span class="statLabel">复习</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStudyStore } from '~/stores/study';

const studyStore = useStudyStore();
const progress = computed(() => studyStore.progress);
</script>

<style scoped>
.progressPanel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: 64px;
  flex-shrink: 0;
}

.progressCard,
.statsCard {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.progressLabel,
.statLabel {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.progressBarOuter {
  width: 8px;
  height: 64px;
  background-color: var(--color-bg-hover);
  border-radius: 4px;
  position: relative;
}

.progressBarInner {
  position: absolute;
  bottom: 0;
  width: 8px;
  height: var(--progress);
  background-color: var(--color-accent);
  border-radius: 4px;
  transition: height 300ms ease, width 300ms ease;
}

.progressText {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.statItem {
  text-align: center;
}

.statValue {
  display: block;
  font-size: 18px;
  font-weight: 700;
}

.statNew {
  color: var(--color-text-primary);
}

.statReview {
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .progressPanel {
    flex-direction: row;
    width: 100%;
    align-items: center;
  }
  .progressCard {
    flex-direction: row;
    flex: 1;
    align-items: center;
  }
  .progressBarOuter {
    width: 100%;
    height: 8px;
    flex: 1;
  }
  .progressBarInner {
    width: var(--progress);
    height: 8px;
    bottom: 0;
    left: 0;
  }
  .statsCard {
    flex-direction: row;
    gap: var(--spacing-md);
    flex-shrink: 0;
  }
}
</style>
