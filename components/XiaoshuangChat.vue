<template>
  <div class="xs-overlay" @click.self="store.close()">
    <aside class="xs-panel">
      <div class="xs-header">
        <h3 class="xs-title">小爽助手</h3>
        <button class="xs-close" @click="store.close()" title="关闭">
          <X :size="18" :stroke-width="1.5" />
        </button>
      </div>

      <div class="xs-messages" ref="messagesEl">
        <div v-if="store.messages.length === 0" class="xs-empty">
          <p>你好！我是小爽，你的成长助手。</p>
          <p>我能看到你所有模块的数据，随时可以聊。</p>
        </div>
        <div
          v-for="(msg, i) in store.messages"
          :key="i"
          class="xs-msg"
          :class="`xs-msg--${msg.role}`"
        >
          <div class="xs-msg-content">{{ msg.content }}</div>
        </div>
        <div v-if="store.isLoading" class="xs-msg xs-msg--assistant">
          <div class="xs-msg-content xs-msg-loading">思考中...</div>
        </div>
      </div>

      <div class="xs-input-area">
        <textarea
          v-model="inputText"
          class="xs-input"
          placeholder="问小爽任何关于你成长的问题..."
          rows="2"
          @keydown.enter.ctrl="handleSend"
          @keydown.enter.meta="handleSend"
        />
        <button
          class="xs-send-btn"
          :disabled="!inputText.trim() || store.isLoading"
          @click="handleSend"
        >
          发送
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { useXiaoshuangStore } from '~/stores/xiaoshuang';

const store = useXiaoshuangStore();
const inputText = ref('');
const messagesEl = ref<HTMLElement | null>(null);

function handleSend() {
  const text = inputText.value.trim();
  if (!text || store.isLoading) return;
  inputText.value = '';
  store.send(text);
  scrollToBottom();
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
    }
  });
}

watch(() => store.messages.length, () => scrollToBottom());
</script>

<style scoped>
.xs-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: flex-end;
}

.xs-panel {
  width: 420px;
  max-width: 100vw;
  height: 100%;
  background-color: var(--color-bg-primary);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
}

.xs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.xs-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.xs-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--spacing-xs);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
}

.xs-close:hover {
  background-color: var(--color-bg-hover);
}

.xs-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md) var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.xs-empty {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
  padding: var(--spacing-lg) 0;
}

.xs-empty p {
  margin: 0 0 var(--spacing-xs) 0;
}

.xs-msg {
  max-width: 85%;
}

.xs-msg--user {
  align-self: flex-end;
}

.xs-msg--assistant {
  align-self: flex-start;
}

.xs-msg-content {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.xs-msg--user .xs-msg-content {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.xs-msg--assistant .xs-msg-content {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.xs-msg-loading {
  color: var(--color-text-secondary);
  font-style: italic;
}

.xs-input-area {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-border);
  align-items: flex-end;
  flex-shrink: 0;
}

.xs-input {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  resize: none;
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
}

.xs-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.xs-send-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.xs-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.xs-send-btn:not(:disabled):hover {
  opacity: 0.9;
}

@media (max-width: 768px) {
  .xs-panel {
    width: 100vw;
  }

  .xs-overlay {
    background-color: transparent;
  }
}
</style>
