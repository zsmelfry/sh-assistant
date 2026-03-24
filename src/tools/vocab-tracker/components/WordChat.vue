<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div v-if="show" class="backdrop" @click="$emit('close')"></div>
    </Transition>

    <!-- Drawer -->
    <Transition name="slide">
      <div v-if="show" class="drawer">
        <!-- Header -->
        <div class="drawerHeader">
          <span class="drawerTitle">{{ word }}</span>
          <button class="closeBtn" @click="$emit('close')">&times;</button>
        </div>

        <!-- Messages -->
        <div ref="messagesEl" class="messages">
          <div v-if="messages.length === 0" class="emptyChat">
            <p class="emptyTitle">关于「{{ word }}」有什么想问的？</p>
            <p class="emptyHint">例如：用法、搭配、语法...</p>
          </div>

          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="bubble"
            :class="msg.role === 'user' ? 'bubbleUser' : 'bubbleAssistant'"
          >
            {{ msg.content }}
          </div>

          <div v-if="isSending" class="bubble bubbleAssistant typing">
            <span>.</span><span>.</span><span>.</span>
          </div>
        </div>

        <!-- Input -->
        <div class="inputBar">
          <textarea
            ref="textareaRef"
            v-model="inputText"
            class="chatInput"
            placeholder="输入问题..."
            rows="1"
            :disabled="isSending"
            @keydown.enter.exact.prevent="handleSend"
            @input="autoResize"
          />
          <button
            class="sendBtn"
            :disabled="!inputText.trim() || isSending"
            @click="handleSend"
          >
            发送
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/composables/useLlm';

const props = withDefaults(defineProps<{
  word: string;
  show: boolean;
  language?: string;
}>(), {
  language: '法语',
});

defineEmits<{
  close: [];
}>();

const { chat } = useLlm();
const messages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
const inputText = ref('');
const isSending = ref(false);
const messagesEl = ref<HTMLElement>();
const { textareaRef, autoResize, resetHeight } = useAutoResize();

watch(() => props.word, () => {
  messages.value = [];
  inputText.value = '';
});

async function scrollToBottom() {
  await nextTick();
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  }
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isSending.value) return;

  messages.value.push({ role: 'user', content: text });
  inputText.value = '';
  resetHeight();
  isSending.value = true;
  await scrollToBottom();

  try {
    const chatMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是${props.language}教学助手。用户正在学习${props.language}单词 "${props.word}"。用中文简洁回答用户的问题。`,
      },
      ...messages.value.map(m => ({ role: m.role, content: m.content })),
    ];
    const response = await chat(chatMessages);
    messages.value.push({ role: 'assistant', content: response.content });
  } catch {
    messages.value.push({ role: 'assistant', content: '抱歉，请求失败了。请检查 LLM 配置。' });
  } finally {
    isSending.value = false;
    await scrollToBottom();
  }
}
</script>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 40;
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  width: 400px;
  max-width: 90vw;
  background-color: var(--color-bg-primary);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.drawerHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.drawerTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.closeBtn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  line-height: 1;
}

.closeBtn:hover {
  background-color: var(--color-bg-hover);
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.emptyChat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.emptyTitle {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.emptyHint {
  font-size: 12px;
  color: var(--color-text-disabled);
  margin-top: var(--spacing-xs);
}

.bubble {
  max-width: 85%;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.bubbleUser {
  align-self: flex-end;
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-bottom-right-radius: var(--radius-sm);
}

.bubbleAssistant {
  align-self: flex-start;
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-bottom-left-radius: var(--radius-sm);
}

.typing span {
  display: inline-block;
  animation: bounce 1s infinite;
  font-size: 18px;
  line-height: 1;
}

.typing span:nth-child(2) { animation-delay: 150ms; }
.typing span:nth-child(3) { animation-delay: 300ms; }

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}

.inputBar {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.chatInput {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  resize: none;
  overflow-y: auto;
}

.chatInput:focus {
  outline: none;
  border-color: var(--color-accent);
}

.sendBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.sendBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.sendBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 300ms ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
