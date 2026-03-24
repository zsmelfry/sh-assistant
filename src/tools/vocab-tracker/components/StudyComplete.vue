<template>
  <div class="completePage">
    <div class="completeIcon">&#10003;</div>
    <h2 class="completeTitle">今日学习完成！</h2>
    <p class="completeHint">干得漂亮，继续保持！</p>

    <div class="completeStats">
      <div class="statBox">
        <span class="statNum">{{ studyStore.sessionNewWords }}</span>
        <span class="statDesc">新词学习</span>
      </div>
      <div class="statDivider"></div>
      <div class="statBox">
        <span class="statNum">{{ studyStore.sessionReviews }}</span>
        <span class="statDesc">复习完成</span>
      </div>
    </div>

    <div class="completeActions">
      <button class="actionBtn ghost" @click="handleBackToOverview">
        返回概览
      </button>
      <button class="actionBtn primary" @click="handleRestart">
        继续学习
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStudyStore } from '~/stores/study';

const studyStore = useStudyStore();

async function handleRestart() {
  await studyStore.loadOverview();
  await studyStore.startSession();
}

function handleBackToOverview() {
  studyStore.resetSession();
  studyStore.loadOverview();
}
</script>

<style scoped>
.completePage {
  text-align: center;
  padding: var(--spacing-xl) 0;
}

.completeIcon {
  width: 56px;
  height: 56px;
  margin: 0 auto var(--spacing-md);
  border: 2px solid var(--color-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--color-accent);
}

.completeTitle {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.completeHint {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
}

.completeStats {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-xl);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}

.statBox {
  text-align: center;
}

.statNum {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.statDesc {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.statDivider {
  width: 1px;
  height: 32px;
  background-color: var(--color-border);
}

.completeActions {
  display: flex;
  justify-content: center;
  gap: var(--spacing-sm);
}

.actionBtn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.actionBtn.ghost {
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.actionBtn.ghost:hover {
  background-color: var(--color-bg-hover);
}

.actionBtn.primary {
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.actionBtn.primary:hover {
  opacity: 0.85;
}
</style>
