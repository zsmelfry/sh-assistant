<template>
  <div class="studyView">
    <!-- Sub-tab navigation -->
    <div class="subTabs">
      <button
        class="subTab"
        :class="{ active: subTab === 'today' }"
        @click="subTab = 'today'"
      >
        今日学习
      </button>
      <button
        class="subTab"
        :class="{ active: subTab === 'history' }"
        @click="subTab = 'history'"
      >
        学习记录
      </button>
    </div>

    <!-- History tab -->
    <template v-if="subTab === 'history'">
      <StudyHistory />
    </template>

    <!-- Today tab -->
    <template v-else>
      <!-- Loading -->
      <div v-if="studyStore.isLoading" class="loadingState">
        <div class="spinner"></div>
        <p>正在准备学习卡片...</p>
      </div>

      <!-- Error -->
      <div v-else-if="studyStore.error" class="errorState">
        <p class="errorMsg">{{ studyStore.error }}</p>
        <button class="retryBtn" @click="handleStartSession">重试</button>
      </div>

      <!-- Session complete -->
      <template v-else-if="studyStore.isSessionComplete">
        <StudyComplete />
      </template>

      <!-- Studying: card + progress -->
      <div v-else-if="studyStore.hasCards && studyStore.currentCard" class="studyLayout">
        <StudyProgress />
        <div class="cardArea">
          <FlashCard
            :card="studyStore.currentCard"
            :is-flipped="studyStore.isFlipped"
            @open-chat="showChat = true"
          />
        </div>
      </div>

      <!-- Overview / start screen -->
      <template v-else>
        <!-- Stats cards -->
        <div v-if="studyStore.overview" class="statsGrid">
          <div class="statCard">
            <span class="statNum">{{ studyStore.overview.cards.total }}</span>
            <span class="statLabel">SRS 卡片</span>
          </div>
          <div class="statCard">
            <span class="statNum">{{ studyStore.overview.cards.due }}</span>
            <span class="statLabel">待复习</span>
          </div>
          <div class="statCard">
            <span class="statNum">{{ studyStore.overview.cards.beginner }}</span>
            <span class="statLabel">初学</span>
          </div>
          <div class="statCard">
            <span class="statNum">{{ studyStore.overview.cards.mastered }}</span>
            <span class="statLabel">已掌握</span>
          </div>
        </div>

        <!-- Today session info -->
        <div class="startSection">
          <h3 class="startTitle">开始今日学习</h3>
          <p class="startHint">复习到期单词 + 学习新词，用间隔重复法高效记忆</p>

          <div v-if="studyStore.overview?.todaySession" class="todayInfo">
            今日已学习：新词 {{ studyStore.overview.todaySession.newWordsStudied }}，
            复习 {{ studyStore.overview.todaySession.reviewsCompleted }}
          </div>

          <button
            class="startBtn"
            :disabled="cannotStudy"
            @click="handleStartSession"
          >
            {{ cannotStudy ? '暂无可学习单词' : '开始学习' }}
          </button>
        </div>
      </template>
    </template>

    <!-- Word chat drawer -->
    <WordChat
      :word="chatWord"
      :show="showChat"
      @close="showChat = false"
    />
  </div>
</template>

<script setup lang="ts">
import { useStudyStore } from '~/stores/study';
import FlashCard from './FlashCard.vue';
import StudyProgress from './StudyProgress.vue';
import StudyComplete from './StudyComplete.vue';
import StudyHistory from './StudyHistory.vue';
import WordChat from './WordChat.vue';

const studyStore = useStudyStore();

const subTab = ref<'today' | 'history'>('today');
const showChat = ref(false);

const chatWord = computed(() => studyStore.currentCard?.word || '');

const cannotStudy = computed(() => {
  const o = studyStore.overview;
  if (!o) return true;
  return o.cards.due === 0 && o.availableLearningCount === 0;
});

onMounted(async () => {
  await studyStore.loadOverview();
});

async function handleStartSession() {
  await studyStore.startSession();
}
</script>

<style scoped>
.studyView {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.subTabs {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.subTab {
  padding: var(--spacing-xs) var(--spacing-md);
  border: none;
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.subTab:not(:last-child) {
  border-right: 1px solid var(--color-border);
}

.subTab.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.subTab:hover:not(.active) {
  background-color: var(--color-bg-hover);
}

.loadingState {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-xl) 0;
  gap: var(--spacing-sm);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.errorState {
  text-align: center;
  padding: var(--spacing-xl) 0;
}

.errorMsg {
  font-size: 14px;
  color: var(--color-danger);
  margin-bottom: var(--spacing-md);
}

.retryBtn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-primary);
}

.retryBtn:hover {
  background-color: var(--color-bg-hover);
}

.studyLayout {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
}

.cardArea {
  flex: 1;
  min-width: 0;
}

.statsGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-sm);
}

.statCard {
  text-align: center;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.statNum {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.statLabel {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.startSection {
  text-align: center;
  padding: var(--spacing-xl) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.startTitle {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.startHint {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
}

.todayInfo {
  font-size: 12px;
  color: var(--color-text-disabled);
  margin-bottom: var(--spacing-md);
}

.startBtn {
  padding: var(--spacing-sm) var(--spacing-xl);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.startBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.startBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .statsGrid {
    grid-template-columns: repeat(2, 1fr);
  }
  .studyLayout {
    flex-direction: column;
  }
  .subTab {
    min-height: var(--touch-target-min);
  }
  .subTab:active:not(.active) {
    background-color: var(--color-bg-hover);
  }
  .startBtn {
    min-height: var(--touch-target-min);
    width: 100%;
  }
  .retryBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
