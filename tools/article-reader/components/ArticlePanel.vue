<template>
  <div class="articlePanel">
    <template v-if="article">
      <!-- 文章元信息 -->
      <header class="articleMeta">
        <h1 class="articleTitle">{{ article.title }}</h1>
        <div v-if="hasMeta" class="metaLine">
          <span v-if="article.siteName" class="metaItem">{{ article.siteName }}</span>
          <span v-if="article.author" class="metaItem">{{ article.author }}</span>
          <span v-if="article.publishedAt" class="metaItem">
            {{ formatDate(article.publishedAt) }}
          </span>
        </div>
      </header>

      <!-- 正文内容 -->
      <div class="articleContent" v-html="article.content" @mouseup="handleSelection" />

      <!-- 浮动工具栏 (Teleport to body) -->
      <Teleport to="body">
        <div
          v-if="showToolbar"
          class="selectionToolbar"
          :style="toolbarStyle"
        >
          <button class="toolbarBtn" @mousedown.prevent="handleQuickTranslate">翻译</button>
          <button class="toolbarBtn" @mousedown.prevent.stop="handleAskAi">提问</button>
        </div>

        <!-- 提问输入面板 -->
        <div
          v-if="showAskPanel"
          ref="askPanelRef"
          class="askPanel"
          :style="askPanelStyle"
          @mousedown.stop
        >
          <div class="askQuote">{{ selectedText }}</div>
          <textarea
            ref="askTextareaRef"
            v-model="askPrompt"
            class="askInput"
            rows="3"
            placeholder="输入你的问题..."
            @keydown.enter.meta.prevent="handleSendAsk"
            @keydown.enter.ctrl.prevent="handleSendAsk"
          />
          <div class="askActions">
            <button class="askBtn askBtnCancel" @click="closeAskPanel">取消</button>
            <button class="askBtn askBtnSend" @click="handleSendAsk">发送</button>
          </div>
        </div>
      </Teleport>
    </template>

    <!-- 空状态 -->
    <div v-else class="emptyState">
      <p class="emptyTitle">请输入文章 URL 开始阅读</p>
      <p class="emptyHint">支持大多数新闻、博客、技术文章网站</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Article } from '../types';

const props = defineProps<{
  article: Article | null;
}>();

const emit = defineEmits<{
  quickTranslate: [text: string];
  askAi: [text: string];
}>();

const store = useArticleReaderStore();

const hasMeta = computed(() =>
  props.article?.siteName || props.article?.author || props.article?.publishedAt,
);

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN');
}

// ===== Text selection toolbar =====
const showToolbar = ref(false);
const toolbarPos = ref({ x: 0, y: 0 });
const selectedText = ref('');

const toolbarStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${toolbarPos.value.x}px`,
  top: `${toolbarPos.value.y}px`,
  transform: 'translateX(-50%)',
  zIndex: 9999,
}));

function handleSelection() {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  if (!text || text.length < 2) {
    showToolbar.value = false;
    return;
  }

  selectedText.value = text;
  const range = selection!.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  toolbarPos.value = {
    x: rect.left + rect.width / 2,
    y: rect.top - 8,
  };
  showToolbar.value = true;
}

function handleQuickTranslate() {
  if (!selectedText.value || !props.article) return;
  showToolbar.value = false;

  // Send as chat message asking for translation
  store.sendChatMessage(`请翻译以下文本：\n\n"${selectedText.value}"`);
  // Notify parent to switch to chat tab
  emit('quickTranslate', selectedText.value);
}

// ===== Ask panel =====
const showAskPanel = ref(false);
const askPrompt = ref('');
const askPanelRef = ref<HTMLElement | null>(null);
const askTextareaRef = ref<HTMLTextAreaElement | null>(null);
const askPanelPos = ref({ x: 0, y: 0 });

const askPanelStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${askPanelPos.value.x}px`,
  top: `${askPanelPos.value.y}px`,
  transform: 'translateX(-50%)',
  zIndex: 9999,
}));

function handleAskAi() {
  if (!selectedText.value || !props.article) return;
  showToolbar.value = false;

  // Position the ask panel where the toolbar was
  askPanelPos.value = { ...toolbarPos.value };
  askPrompt.value = '请解释这段话背后的逻辑和深层含义';
  showAskPanel.value = true;

  nextTick(() => {
    askTextareaRef.value?.focus();
    askTextareaRef.value?.select();
  });
}

function handleSendAsk() {
  if (!askPrompt.value.trim() || !selectedText.value) return;
  const message = `${askPrompt.value.trim()}\n\n"${selectedText.value}"`;
  store.sendChatMessage(message);
  showAskPanel.value = false;
  emit('askAi', selectedText.value);
}

function closeAskPanel() {
  showAskPanel.value = false;
}

// Hide toolbar / ask panel when clicking elsewhere
function handleClickOutside(e: MouseEvent) {
  if (showAskPanel.value) {
    if (askPanelRef.value && !askPanelRef.value.contains(e.target as Node)) {
      showAskPanel.value = false;
    }
    return;
  }
  showToolbar.value = false;
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<style scoped>
.articlePanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

/* 元信息 */
.articleMeta {
  flex-shrink: 0;
  padding-bottom: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.articleTitle {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  margin-bottom: var(--spacing-sm);
}

.metaLine {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.metaItem:not(:last-child)::after {
  content: '\00B7';
  margin-left: var(--spacing-xs);
}

/* 正文内容 — 深度选择器覆盖 v-html 内部元素 */
.articleContent {
  flex: 1;
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-text-primary);
}

.articleContent :deep(h1),
.articleContent :deep(h2),
.articleContent :deep(h3),
.articleContent :deep(h4) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text-primary);
}

.articleContent :deep(h1) { font-size: 1.4em; }
.articleContent :deep(h2) { font-size: 1.25em; }
.articleContent :deep(h3) { font-size: 1.1em; }

.articleContent :deep(p) {
  margin-bottom: 1em;
}

.articleContent :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  margin: var(--spacing-md) 0;
}

.articleContent :deep(a) {
  color: var(--color-text-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.articleContent :deep(a:hover) {
  opacity: 0.7;
}

.articleContent :deep(blockquote) {
  margin: var(--spacing-md) 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border-left: 3px solid var(--color-border);
  color: var(--color-text-secondary);
}

.articleContent :deep(pre) {
  margin: var(--spacing-md) 0;
  padding: var(--spacing-md);
  background-color: var(--color-bg-sidebar);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

.articleContent :deep(code) {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

.articleContent :deep(:not(pre) > code) {
  padding: 1px 4px;
  background-color: var(--color-bg-sidebar);
  border-radius: 3px;
}

.articleContent :deep(ul),
.articleContent :deep(ol) {
  margin-bottom: 1em;
  padding-left: 1.5em;
}

.articleContent :deep(li) {
  margin-bottom: 0.3em;
}

.articleContent :deep(hr) {
  margin: var(--spacing-lg) 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

.articleContent :deep(table) {
  width: 100%;
  margin: var(--spacing-md) 0;
  border-collapse: collapse;
  font-size: 14px;
}

.articleContent :deep(th),
.articleContent :deep(td) {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  text-align: left;
}

.articleContent :deep(th) {
  background-color: var(--color-bg-sidebar);
  font-weight: 600;
}

.articleContent :deep(figure) {
  margin: var(--spacing-md) 0;
}

.articleContent :deep(figcaption) {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  margin-top: var(--spacing-xs);
}

/* 空状态 */
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
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

@media (max-width: 768px) {
  .articleTitle {
    font-size: 18px;
  }
  .articleContent {
    font-size: 14px;
  }
}
</style>

<!-- Unscoped styles for the Teleported toolbar -->
<style>
.selectionToolbar {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--color-accent);
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: fadeInDown 0.15s ease;
}

.selectionToolbar .toolbarBtn {
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--color-accent-inverse);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.15s;
}

.selectionToolbar .toolbarBtn:hover {
  background: rgba(255, 255, 255, 0.15);
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 提问输入面板 */
.askPanel {
  width: 380px;
  max-width: 90vw;
  padding: var(--spacing-md);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  animation: fadeInDown 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.askQuote {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-sidebar);
  border-left: 3px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  max-height: 80px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.askInput {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  resize: none;
  outline: none;
  transition: border-color var(--transition-fast);
}

.askInput:focus {
  border-color: var(--color-accent);
}

.askInput::placeholder {
  color: var(--color-text-disabled);
}

.askActions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-xs);
}

.askBtn {
  padding: 5px 14px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.askBtn:hover {
  opacity: 0.8;
}

.askBtnCancel {
  background: var(--color-bg-sidebar);
  color: var(--color-text-secondary);
}

.askBtnSend {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}
</style>
