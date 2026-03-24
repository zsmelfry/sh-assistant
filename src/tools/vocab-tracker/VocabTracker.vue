<template>
  <div class="vocabTracker">
    <!-- 顶部工具栏 -->
    <div v-if="!store.hasWords" class="toolbar">
      <div class="toolbarRight">
        <button class="toolbarBtn" @click="showImportModal = true">
          导入 CSV
        </button>
      </div>
    </div>

    <!-- 初始化错误 -->
    <div v-if="initError" class="emptyState">
      <p class="errorMsg">{{ initError }}</p>
      <button class="primaryBtn" @click="handleReload">刷新页面</button>
    </div>

    <!-- 无词汇状态 -->
    <div v-else-if="!store.hasWords && store.filter === 'all' && !store.searchQuery && activeTab === 'vocab'" class="emptyState">
      <p class="emptyTitle">词库为空</p>
      <p class="emptyHint">请先导入 CSV 词汇文件</p>
      <button class="primaryBtn" @click="showImportModal = true">
        导入 CSV
      </button>
    </div>

    <!-- 主内容（有用户有词汇） -->
    <template v-else>
      <!-- Tab 切换 -->
      <div class="mainTabs">
        <button
          class="mainTab"
          :class="{ active: activeTab === 'vocab' }"
          @click="activeTab = 'vocab'"
        >
          词汇列表
        </button>
        <button
          class="mainTab"
          :class="{ active: activeTab === 'study' }"
          @click="activeTab = 'study'"
        >
          学习模式
        </button>
        <button
          class="mainTab"
          :class="{ active: activeTab === 'categorize' }"
          @click="activeTab = 'categorize'"
        >
          快速分类
        </button>
      </div>

      <!-- 词汇列表 Tab -->
      <div v-show="activeTab === 'vocab'" class="tabContent">
        <StatsPanel />
        <ProgressChart />
        <VocabList />
      </div>

      <!-- 学习模式 Tab -->
      <div v-show="activeTab === 'study'" class="tabContent">
        <StudyView />
      </div>

      <!-- 快速分类 Tab -->
      <div v-show="activeTab === 'categorize'" class="tabContent">
        <CategorizeView />
      </div>
    </template>

    <!-- 模态框 -->
    <ImportModal :open="showImportModal" @close="showImportModal = false" />
  </div>
</template>

<script setup lang="ts">
import StatsPanel from './components/StatsPanel.vue';
import ProgressChart from './components/ProgressChart.vue';
import VocabList from './components/VocabList.vue';
import ImportModal from './components/ImportModal.vue';
import StudyView from './components/StudyView.vue';
import CategorizeView from './components/CategorizeView.vue';

const store = useVocabStore();

const activeTab = ref<'vocab' | 'study' | 'categorize'>('vocab');
const showImportModal = ref(false);
const initError = ref('');

function handleReload() {
  globalThis.location.reload();
}

onMounted(async () => {
  try {
    await store.initialize();
  } catch {
    initError.value = '加载数据失败，请刷新页面重试。';
  }
});
</script>

<style scoped>
.vocabTracker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-width: 900px;
  margin: 0 auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbarRight {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.userInfo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.currentUserName {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.toolbarBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.toolbarBtn:hover {
  background-color: var(--color-bg-hover);
}

.mainTabs {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.mainTab {
  padding: var(--spacing-xs) var(--spacing-lg);
  border: none;
  background: var(--color-bg-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.mainTab:not(:last-child) {
  border-right: 1px solid var(--color-border);
}

.mainTab.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.mainTab:hover:not(.active) {
  background-color: var(--color-bg-hover);
}

.tabContent {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-xl) 0;
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

.primaryBtn {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.primaryBtn:hover {
  opacity: 0.85;
}

.errorMsg {
  font-size: 14px;
  color: var(--color-danger);
}

@media (max-width: 768px) {
  .vocabTracker {
  }
  .mainTabs {
    display: flex;
    width: 100%;
  }
  .mainTab {
    flex: 1;
    min-height: var(--touch-target-min);
    padding: var(--spacing-sm);
    font-size: 13px;
  }
  .toolbarBtn {
    min-height: var(--touch-target-min);
  }
  .primaryBtn {
    min-height: var(--touch-target-min);
    width: 100%;
  }
}
</style>
