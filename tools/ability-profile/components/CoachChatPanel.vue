<template>
  <div class="coach-chat">
    <div class="chat-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="page-title">小爽助手</h2>
      <p class="chat-hint">也可以通过侧边栏底部的按钮随时呼出</p>
    </div>

    <div class="chat-messages" ref="messagesContainer">
      <div v-if="store.messages.length === 0" class="empty-hint">
        <p>你好！我是小爽，你的成长助手。</p>
        <p>我能看到你所有模块的数据，随时可以聊。</p>
      </div>
      <div
        v-for="(msg, i) in store.messages"
        :key="i"
        class="message"
        :class="`message--${msg.role}`"
      >
        <div class="message-content">{{ msg.content }}</div>
      </div>
      <div v-if="store.isLoading" class="message message--assistant">
        <div class="message-content message-loading">思考中...</div>
      </div>
    </div>

    <div class="chat-input">
      <textarea
        v-model="inputText"
        class="input-field"
        placeholder="问小爽任何关于你成长的问题..."
        rows="2"
        @keydown.enter.ctrl="sendMessage"
      />
      <BaseButton :disabled="!inputText.trim() || store.isLoading" @click="sendMessage">
        发送
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useXiaoshuangStore } from '~/stores/xiaoshuang';

defineEmits<{
  back: [];
}>();

const store = useXiaoshuangStore();
const inputText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || store.isLoading) return;
  inputText.value = '';
  store.send(text);
  scrollToBottom();
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

watch(() => store.messages.length, () => scrollToBottom());
</script>

<style scoped>
.coach-chat {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.chat-header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.back-btn {
  align-self: flex-start;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs) 0;
}

.back-btn:hover {
  color: var(--color-text-primary);
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.chat-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md) 0;
}

.empty-hint {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.empty-hint p {
  margin: 0 0 var(--spacing-xs) 0;
}

.message {
  max-width: 80%;
}

.message--user {
  align-self: flex-end;
}

.message--assistant {
  align-self: flex-start;
}

.message-content {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.message--user .message-content {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.message--assistant .message-content {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.message-loading {
  color: var(--color-text-secondary);
  font-style: italic;
}

.chat-input {
  display: flex;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  align-items: flex-end;
}

.input-field {
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

.input-field:focus {
  outline: none;
  border-color: var(--color-accent);
}
</style>
