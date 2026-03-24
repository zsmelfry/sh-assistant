<template>
  <div class="aiChatPanel" :class="{ open: open }">
    <div class="panelHeader">
      <h4>AI 对话</h4>
      <div class="panelActions">
        <button class="iconBtn" title="清空对话" @click="handleClear">清空</button>
        <button class="iconBtn" @click="$emit('close')">&times;</button>
      </div>
    </div>

    <div ref="messagesEl" class="messageList">
      <div v-if="messages.length === 0" class="emptyChat">
        <p>问我任何关于这个事项的问题</p>
        <div class="quickActions">
          <button @click="sendQuick('分析一下当前的进度情况')">分析进度</button>
          <button @click="sendQuick('建议下一步应该做什么')">建议下一步</button>
          <button @click="sendQuick('帮我总结笔记内容')">总结笔记</button>
        </div>
      </div>
      <ChatMessageComp
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
      <div v-if="sending" class="typingIndicator">AI 思考中...</div>
    </div>

    <div class="inputArea">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="chatTextarea"
        placeholder="输入消息..."
        rows="1"
        :disabled="sending"
        @keydown.enter.exact.prevent="handleSend"
        @input="autoResize"
      />
      <BaseButton size="sm" :disabled="!inputText.trim() || sending" @click="handleSend">
        发送
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '../types';
import ChatMessageComp from './ChatMessage.vue';

const props = defineProps<{
  projectId: number;
  open: boolean;
}>();

defineEmits<{
  close: [];
}>();

const messages = ref<ChatMessage[]>([]);
const inputText = ref('');
const sending = ref(false);
const messagesEl = ref<HTMLElement | null>(null);
const { textareaRef, autoResize, resetHeight } = useAutoResize();

async function loadMessages() {
  messages.value = await $fetch<ChatMessage[]>(
    `/api/project-tracker/projects/${props.projectId}/chat/messages`,
  );
  scrollToBottom();
}

watch(() => props.open, (isOpen) => {
  if (isOpen) loadMessages();
});

onMounted(() => {
  if (props.open) loadMessages();
});

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
    }
  });
}

async function handleSend() {
  const content = inputText.value.trim();
  if (!content || sending.value) return;

  inputText.value = '';
  resetHeight();
  sending.value = true;

  // Optimistic: add user message locally
  messages.value.push({
    id: Date.now(),
    projectId: props.projectId,
    role: 'user',
    content,
    createdAt: Date.now(),
  });
  scrollToBottom();

  try {
    const result = await $fetch<{ content: string }>(
      `/api/project-tracker/projects/${props.projectId}/chat/send`,
      { method: 'POST', body: { content } },
    );

    messages.value.push({
      id: Date.now() + 1,
      projectId: props.projectId,
      role: 'assistant',
      content: result.content,
      createdAt: Date.now(),
    });
    scrollToBottom();
  } catch (err: any) {
    messages.value.push({
      id: Date.now() + 1,
      projectId: props.projectId,
      role: 'assistant',
      content: `错误: ${err.data?.message || err.message || 'AI 回复失败'}`,
      createdAt: Date.now(),
    });
    scrollToBottom();
  } finally {
    sending.value = false;
  }
}

function sendQuick(text: string) {
  inputText.value = text;
  handleSend();
}

async function handleClear() {
  await $fetch(`/api/project-tracker/projects/${props.projectId}/chat/clear`, { method: 'DELETE' });
  messages.value = [];
}
</script>

<style scoped>
.aiChatPanel {
  position: fixed;
  right: -400px;
  top: 0;
  bottom: 0;
  width: 400px;
  background: var(--color-bg-primary);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: right 0.3s ease;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
}

.aiChatPanel.open {
  right: 0;
}

.panelHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.panelHeader h4 {
  font-size: 15px;
  font-weight: 700;
}

.panelActions {
  display: flex;
  gap: var(--spacing-xs);
}

.iconBtn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs);
}

.iconBtn:hover {
  color: var(--color-text-primary);
}

.messageList {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.emptyChat {
  text-align: center;
  padding: var(--spacing-xl) 0;
  color: var(--color-text-secondary);
}

.emptyChat p {
  margin-bottom: var(--spacing-md);
}

.quickActions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  justify-content: center;
}

.quickActions button {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
}

.quickActions button:hover {
  background: var(--color-bg-hover);
}

.typingIndicator {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-style: italic;
  padding: var(--spacing-xs) var(--spacing-md);
}

.inputArea {
  display: flex;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.chatTextarea {
  flex: 1;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  resize: none;
  overflow-y: auto;
  outline: none;
}

.chatTextarea:focus {
  border-color: var(--color-accent);
}

@media (max-width: 768px) {
  .aiChatPanel {
    width: 100%;
    right: -100%;
  }
}
</style>
