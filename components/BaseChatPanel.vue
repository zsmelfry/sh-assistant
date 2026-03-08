<template>
  <div class="chatPanel">
    <!-- Header -->
    <div v-if="messages.length > 0" class="chatHeader">
      <button class="clearBtn" @click="$emit('clear')">清空对话</button>
    </div>

    <!-- Messages -->
    <div ref="messagesRef" class="messageList">
      <div v-if="messages.length === 0 && !loading" class="emptyChat">
        <p class="emptyTitle">{{ emptyTitle }}</p>
        <p class="emptyHint">{{ emptyHint }}</p>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="msg.role"
      >
        <div class="bubbleWrap">
          <div class="bubble" v-html="renderMessage(msg.content)" />
          <button
            v-if="msg.role === 'assistant'"
            class="copyBtn"
            @click="copyMessage(msg)"
          >
            {{ copiedId === msg.id ? '已复制' : '复制' }}
          </button>
        </div>
      </div>

      <!-- Loading indicator -->
      <div v-if="loading" class="message assistant">
        <div class="bubble loading">
          <span class="dot" /><span class="dot" /><span class="dot" />
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="chatError">
        {{ error }}
      </div>
    </div>

    <!-- Quick questions slot -->
    <slot name="above-input" />

    <!-- Input -->
    <div class="chatInput">
      <textarea
        ref="inputRef"
        v-model="inputText"
        class="chatTextarea"
        placeholder="输入问题..."
        rows="1"
        @keydown.enter.exact.prevent="handleSend"
        @input="autoResize"
      />
      <button
        class="sendBtn"
        :disabled="!inputText.trim() || loading"
        @click="handleSend"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked';

interface ChatMsg {
  id: number;
  role: string;
  content: string;
}

const props = defineProps<{
  messages: ChatMsg[];
  loading: boolean;
  error: string | null;
  emptyTitle: string;
  emptyHint: string;
}>();

const emit = defineEmits<{
  send: [message: string];
  clear: [];
}>();

const { textareaRef: inputRef, autoResize, resetHeight } = useAutoResize();
const messagesRef = ref<HTMLElement | null>(null);
const inputText = ref('');
const copiedId = ref<number | null>(null);

function copyMessage(msg: ChatMsg): void {
  navigator.clipboard.writeText(msg.content);
  copiedId.value = msg.id;
  setTimeout(() => { copiedId.value = null; }, 1500);
}

function scrollToBottom(): void {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
  });
}

// Auto-scroll on message count or loading state change
watch([() => props.messages.length, () => props.loading], () => scrollToBottom());

function renderMessage(content: string): string {
  return marked.parse(content, { breaks: true }) as string;
}

function handleSend(): void {
  if (!inputText.value.trim() || props.loading) return;
  const message = inputText.value;
  inputText.value = '';
  resetHeight();
  emit('send', message);
}
</script>

<style scoped>
.chatPanel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chatHeader {
  display: flex;
  justify-content: flex-end;
  padding-bottom: var(--spacing-sm);
  flex-shrink: 0;
}

.clearBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.clearBtn:hover {
  background-color: var(--color-bg-hover);
}

/* Message list */
.messageList {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
}

.emptyChat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--spacing-sm);
  min-height: 200px;
}

.emptyTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.emptyHint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* Messages */
.message {
  display: flex;
  max-width: 85%;
}

.message.user {
  align-self: flex-end;
}

.message.assistant {
  align-self: flex-start;
}

.bubbleWrap {
  position: relative;
}

.copyBtn {
  position: absolute;
  top: var(--spacing-xs);
  right: var(--spacing-xs);
  padding: 2px var(--spacing-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.bubbleWrap:hover .copyBtn {
  opacity: 1;
}

.bubble {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.message.user .bubble {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-bottom-right-radius: var(--radius-sm);
}

.message.assistant .bubble {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-bottom-left-radius: var(--radius-sm);
}

/* Markdown in bubbles */
.bubble :deep(p) {
  margin-bottom: 0.5em;
}

.bubble :deep(p:last-child) {
  margin-bottom: 0;
}

.bubble :deep(h1),
.bubble :deep(h2),
.bubble :deep(h3),
.bubble :deep(h4) {
  margin-top: 0.8em;
  margin-bottom: 0.4em;
  font-weight: 600;
  line-height: 1.3;
}

.bubble :deep(h1) { font-size: 1.2em; }
.bubble :deep(h2) { font-size: 1.1em; }
.bubble :deep(h3) { font-size: 1em; }

.bubble :deep(ul),
.bubble :deep(ol) {
  margin-bottom: 0.5em;
  padding-left: 1.4em;
}

.bubble :deep(li) {
  margin-bottom: 0.2em;
}

.bubble :deep(blockquote) {
  margin: 0.4em 0;
  padding: 2px var(--spacing-sm);
  border-left: 3px solid var(--color-border);
  color: var(--color-text-secondary);
}

.bubble :deep(pre) {
  margin: 0.4em 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-bg-sidebar);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  font-size: 13px;
}

.bubble :deep(code) {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

.bubble :deep(:not(pre) > code) {
  padding: 1px 4px;
  background: var(--color-bg-sidebar);
  border-radius: 3px;
}

.bubble :deep(strong) {
  font-weight: 600;
}

.bubble :deep(a) {
  color: var(--color-text-primary);
  text-decoration: underline;
}

.bubble :deep(hr) {
  margin: 0.5em 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

/* Loading dots */
.bubble.loading {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-text-secondary);
  animation: blink 1.4s infinite both;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

/* Error */
.chatError {
  text-align: center;
  font-size: 13px;
  color: var(--color-danger);
  padding: var(--spacing-xs);
}

/* Input area */
.chatInput {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-end;
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.chatTextarea {
  flex: 1;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.4;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  resize: none;
  outline: none;
  overflow-y: auto;
  transition: border-color var(--transition-fast);
}

.chatTextarea:focus {
  border-color: var(--color-accent);
}

.chatTextarea::placeholder {
  color: var(--color-text-disabled);
}

.sendBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity var(--transition-fast);
}

.sendBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.sendBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .message {
    max-width: 90%;
  }
  .sendBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
