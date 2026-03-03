<template>
  <div class="translationPanel">
    <!-- Tab 切换 -->
    <div class="panelTabs">
      <button
        class="panelTab"
        :class="{ active: activeTab === 'full' }"
        @click="activeTab = 'full'"
      >
        完整翻译
      </button>
      <button
        class="panelTab"
        :class="{ active: activeTab === 'summary' }"
        @click="activeTab = 'summary'"
      >
        精简概括
      </button>
      <button
        class="panelTab"
        :class="{ active: activeTab === 'notes' }"
        @click="activeTab = 'notes'"
      >
        笔记
      </button>
      <button
        class="panelTab"
        :class="{ active: activeTab === 'chat' }"
        @click="activeTab = 'chat'"
      >
        AI 聊天
      </button>
    </div>

    <!-- 聊天 tab -->
    <div v-if="activeTab === 'chat'" class="panelBody">
      <ChatPanel />
    </div>

    <!-- 笔记 tab -->
    <div v-else-if="activeTab === 'notes'" class="panelBody">
      <NoteEditor />
    </div>

    <!-- 翻译内容区 -->
    <div v-else class="panelBody">
      <!-- 当前 tab 有内容 -->
      <div v-if="currentContent" class="translationContent" v-html="renderedContent" />

      <!-- 正在翻译 -->
      <div v-else-if="isTranslating" class="loadingState">
        <div class="spinner" />
        <span>{{ activeTab === 'full' ? '正在翻译全文...' : '正在生成概括...' }}</span>
      </div>

      <!-- 翻译出错 -->
      <div v-else-if="translateError" class="errorState">
        <p class="errorMsg">{{ translateError }}</p>
        <button
          class="translateBtn"
          @click="handleTranslate(activeTab as 'full' | 'summary')"
        >
          重试
        </button>
      </div>

      <!-- 未翻译 — 显示触发按钮 -->
      <div v-else class="emptyState">
        <p class="emptyHint">
          {{ activeTab === 'full' ? '点击下方按钮翻译全文' : '点击下方按钮生成概括' }}
        </p>
        <div class="actionButtons">
          <button
            class="translateBtn"
            :disabled="store.translating.full || store.translating.summary"
            @click="handleTranslate(activeTab as 'full' | 'summary')"
          >
            {{ activeTab === 'full' ? '翻译全文' : '生成概括' }}
          </button>
          <button
            v-if="!otherContent"
            class="translateBtnSecondary"
            :disabled="store.translating.full || store.translating.summary"
            @click="handleTranslateBoth"
          >
            两者都要
          </button>
        </div>
      </div>
    </div>

    <!-- 底部：已有翻译时可重新翻译 -->
    <div v-if="activeTab !== 'notes' && activeTab !== 'chat' && currentContent && !isTranslating" class="panelFooter">
      <button
        class="retranslateBtn"
        :disabled="store.translating.full || store.translating.summary"
        @click="handleTranslate(activeTab as 'full' | 'summary')"
      >
        重新{{ activeTab === 'full' ? '翻译' : '概括' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PanelTab } from '../types';
import NoteEditor from './NoteEditor.vue';
import ChatPanel from './ChatPanel.vue';

const store = useArticleReaderStore();
const activeTab = defineModel<PanelTab>('activeTab', { default: 'full' });
const translateError = ref<string | null>(null);

const currentContent = computed(() => store.translations[activeTab.value]);
const otherContent = computed(() => store.translations[activeTab.value === 'full' ? 'summary' : 'full']);
const isTranslating = computed(() => store.translating[activeTab.value]);

// Auto-trigger translation when switching to a translation tab with no content
watch(activeTab, (tab) => {
  if (tab === 'notes' || tab === 'chat') return;
  if (!store.translations[tab] && !store.translating[tab] && store.currentArticle) {
    handleTranslate(tab);
  }
});

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const renderedContent = computed(() => {
  const text = currentContent.value;
  if (!text) return '';
  // Escape HTML to prevent XSS, then wrap paragraphs
  return escapeHtml(text)
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
});

async function handleTranslate(type: 'full' | 'summary') {
  translateError.value = null;
  try {
    await store.translateArticle(type);
  } catch (e: unknown) {
    translateError.value = extractErrorMessage(e, '翻译失败');
  }
}

async function handleTranslateBoth() {
  translateError.value = null;
  try {
    await Promise.all([
      store.translateArticle('full'),
      store.translateArticle('summary'),
    ]);
  } catch (e: unknown) {
    translateError.value = extractErrorMessage(e, '翻译失败');
  }
}
</script>

<style scoped>
.translationPanel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Tab 切换 */
.panelTabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
}

.panelTab {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
  transition: all var(--transition-fast);
}

.panelTab.active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-accent);
}

.panelTab:hover:not(.active) {
  color: var(--color-text-primary);
}

/* 内容区 */
.panelBody {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md) 0;
}

/* 翻译内容 */
.translationContent {
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-text-primary);
}

.translationContent :deep(p) {
  margin-bottom: 1em;
}

.translationContent :deep(p:last-child) {
  margin-bottom: 0;
}

/* 加载状态 */
.loadingState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  height: 100%;
  min-height: 200px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 错误状态 */
.errorState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  height: 100%;
  min-height: 200px;
}

.errorMsg {
  font-size: 14px;
  color: var(--color-danger);
}

/* 空状态 + 翻译按钮 */
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  height: 100%;
  min-height: 200px;
}

.emptyHint {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.actionButtons {
  display: flex;
  gap: var(--spacing-sm);
}

.translateBtn {
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

.translateBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.translateBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.translateBtnSecondary {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.translateBtnSecondary:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.translateBtnSecondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 底部重新翻译 */
.panelFooter {
  flex-shrink: 0;
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.retranslateBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.retranslateBtn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.retranslateBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .translateBtn,
  .translateBtnSecondary {
    min-height: var(--touch-target-min);
    flex: 1;
  }
  .actionButtons {
    width: 100%;
  }
  .retranslateBtn {
    min-height: var(--touch-target-min);
    width: 100%;
  }
}
</style>
