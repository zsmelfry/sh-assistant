<template>
  <div class="articleReader">
    <!-- 顶部视图切换 -->
    <div class="topBar">
      <div class="mainTabs">
        <button
          class="mainTab"
          :class="{ active: store.currentView === 'reading' }"
          @click="store.currentView = 'reading'"
        >
          阅读
        </button>
        <button
          class="mainTab"
          :class="{ active: store.currentView === 'bookmarks' }"
          @click="store.currentView = 'bookmarks'"
        >
          收藏库
        </button>
      </div>
    </div>

    <!-- 阅读视图 -->
    <template v-if="store.currentView === 'reading'">
      <UrlInput />

      <!-- 分屏阅读区 -->
      <div v-if="store.currentArticle" class="splitView">
        <!-- 左侧 — 原文面板 -->
        <div class="leftPanel" :style="leftPanelStyle">
          <ArticlePanel
            :article="store.currentArticle"
            @quick-translate="rightPanelTab = 'chat'"
            @ask-ai="rightPanelTab = 'chat'"
          />
        </div>

        <!-- 拖拽分隔条 -->
        <div
          class="resizeDivider"
          :class="{ dragging: isDragging }"
          @mousedown="startResize"
          @dblclick="splitRatio = 50"
          @touchstart.prevent="startTouchResize"
        >
          <div class="dividerHandle" />
        </div>

        <!-- 右侧 — 译文面板 -->
        <div class="rightPanel" :style="rightPanelStyle">
          <TranslationPanel v-model:active-tab="rightPanelTab" />
        </div>
      </div>

      <!-- 空状态（无文章且不在加载） -->
      <div v-else-if="!store.fetchLoading" class="emptyState">
        <p class="emptyTitle">粘贴文章链接开始阅读</p>
        <p class="emptyHint">支持大多数新闻、博客、技术文章网站</p>
      </div>
    </template>

    <!-- 收藏库视图 -->
    <BookmarkList v-if="store.currentView === 'bookmarks'" />
  </div>
</template>

<script setup lang="ts">
import UrlInput from './components/UrlInput.vue';
import ArticlePanel from './components/ArticlePanel.vue';
import TranslationPanel from './components/TranslationPanel.vue';
import BookmarkList from './components/BookmarkList.vue';

const store = useArticleReaderStore();

// Right panel active tab (for text selection → chat switching)
const rightPanelTab = ref<'full' | 'summary' | 'notes' | 'chat'>('full');

// ===== Split pane resize =====
const splitRatio = ref(50); // percentage for left panel
const isDragging = ref(false);

const leftPanelStyle = computed(() => ({
  flex: `0 0 calc(${splitRatio.value}% - 6px)`,
}));

const rightPanelStyle = computed(() => ({
  flex: `0 0 calc(${100 - splitRatio.value}% - 6px)`,
}));

function startResize(e: MouseEvent) {
  e.preventDefault();
  isDragging.value = true;
  const startX = e.clientX;
  const startRatio = splitRatio.value;

  const splitViewEl = (e.target as HTMLElement).parentElement;
  if (!splitViewEl) return;
  const totalWidth = splitViewEl.offsetWidth;

  function onMouseMove(ev: MouseEvent) {
    const dx = ev.clientX - startX;
    const newRatio = startRatio + (dx / totalWidth) * 100;
    splitRatio.value = Math.max(20, Math.min(80, newRatio));
  }

  function onMouseUp() {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function startTouchResize(e: TouchEvent) {
  isDragging.value = true;
  const startX = e.touches[0].clientX;
  const startRatio = splitRatio.value;

  const splitViewEl = (e.target as HTMLElement).parentElement;
  if (!splitViewEl) return;
  const totalWidth = splitViewEl.offsetWidth;

  function onTouchMove(ev: TouchEvent) {
    const dx = ev.touches[0].clientX - startX;
    const newRatio = startRatio + (dx / totalWidth) * 100;
    splitRatio.value = Math.max(20, Math.min(80, newRatio));
  }

  function onTouchEnd() {
    isDragging.value = false;
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  }

  document.addEventListener('touchmove', onTouchMove);
  document.addEventListener('touchend', onTouchEnd);
}
</script>

<style scoped>
.articleReader {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
}

.topBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
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

/* 分屏布局 */
.splitView {
  display: flex;
  flex: 1;
  min-height: 0;
}

.leftPanel,
.rightPanel {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 拖拽分隔条 */
.resizeDivider {
  flex-shrink: 0;
  width: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  user-select: none;
}

.resizeDivider:hover .dividerHandle,
.resizeDivider.dragging .dividerHandle {
  background-color: var(--color-accent);
}

.dividerHandle {
  width: 3px;
  height: 32px;
  border-radius: 2px;
  background-color: var(--color-border);
  transition: background-color var(--transition-fast);
}

/* 空状态 */
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
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

/* 移动端 */
@media (max-width: 768px) {
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
  .splitView {
    flex-direction: column;
    min-height: auto;
  }
  .leftPanel,
  .rightPanel {
    flex: 1 1 auto !important;
  }
  .resizeDivider {
    display: none;
  }
}
</style>
