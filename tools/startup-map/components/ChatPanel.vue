<template>
  <div class="chatPanel">
    <!-- Header -->
    <div v-if="store.chats.length > 0" class="chatHeader">
      <button class="clearBtn" @click="handleClear">清空对话</button>
    </div>

    <!-- Messages -->
    <div ref="messagesRef" class="messageList">
      <div v-if="store.chats.length === 0 && !store.chatSending" class="emptyChat">
        <p class="emptyTitle">AI 创业导师</p>
        <p class="emptyHint">问我任何关于这个知识点的问题</p>
      </div>

      <div
        v-for="msg in store.chats"
        :key="msg.id"
        class="message"
        :class="msg.role"
      >
        <div class="bubble" v-html="renderMessage(msg.content)" />
      </div>

      <!-- Loading indicator -->
      <div v-if="store.chatSending" class="message assistant">
        <div class="bubble loading">
          <span class="dot" /><span class="dot" /><span class="dot" />
        </div>
      </div>

      <!-- Error -->
      <div v-if="store.chatError" class="chatError">
        {{ store.chatError }}
      </div>
    </div>

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
        :disabled="!inputText.trim() || store.chatSending"
        @click="handleSend"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  pointId: number;
}>();

const store = useStartupMapStore();
const messagesRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);
const inputText = ref('');

onMounted(() => {
  store.loadChats(props.pointId);
});

watch(() => props.pointId, (id) => {
  store.loadChats(id);
});

// Auto-scroll on new messages
watch(() => store.chats.length, () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
  });
});

watch(() => store.chatSending, () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
  });
});

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMessage(content: string): string {
  return escapeHtml(content)
    .split('\n')
    .map(line => line || '<br>')
    .join('<br>');
}

async function handleSend() {
  if (!inputText.value.trim() || store.chatSending) return;
  const message = inputText.value;
  inputText.value = '';
  if (inputRef.value) inputRef.value.style.height = 'auto';
  await store.sendChat(props.pointId, message);
}

function handleClear() {
  store.clearChats(props.pointId);
}

function autoResize() {
  const el = inputRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
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
