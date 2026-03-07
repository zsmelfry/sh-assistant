<template>
  <div class="onboarding-chat">
    <div class="chat-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="page-title">AI 快速建档</h2>
    </div>

    <div class="chat-messages" ref="messagesContainer">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="message"
        :class="`message--${msg.role}`"
      >
        <div class="message-content">{{ msg.content }}</div>
      </div>
      <div v-if="sending" class="message message--assistant">
        <div class="message-content message-loading">思考中...</div>
      </div>

      <!-- Completion summary -->
      <div v-if="completed && createdSkills.length > 0" class="summary">
        <h3 class="summary-title">已创建的技能</h3>
        <ul class="summary-list">
          <li v-for="skill in createdSkills" :key="skill.id" class="summary-item">
            {{ skill.name }}
          </li>
        </ul>
        <BaseButton @click="$emit('done')">开始使用</BaseButton>
      </div>
    </div>

    <div v-if="!completed" class="chat-input">
      <textarea
        v-model="inputText"
        class="input-field"
        placeholder="描述你的工作、学习或兴趣..."
        rows="2"
        @keydown.enter.ctrl="sendMessage"
      />
      <BaseButton :disabled="!inputText.trim() || sending" @click="sendMessage">
        发送
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">

defineEmits<{
  back: [];
  done: [];
}>();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CreatedSkill {
  id: number;
  name: string;
}

const messages = ref<ChatMessage[]>([]);
const history = ref<{ role: string; content: string }[]>([]);
const inputText = ref('');
const sending = ref(false);
const completed = ref(false);
const createdSkills = ref<CreatedSkill[]>([]);
const messagesContainer = ref<HTMLElement | null>(null);

const GREETING = '你好！我是你的能力教练。告诉我你目前在做什么工作或学习，有什么兴趣爱好？我来帮你快速建立技能档案。';

onMounted(() => {
  messages.value.push({ role: 'assistant', content: GREETING });
  history.value.push({ role: 'assistant', content: GREETING });
});

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || sending.value) return;

  messages.value.push({ role: 'user', content: text });
  history.value.push({ role: 'user', content: text });
  inputText.value = '';
  sending.value = true;

  scrollToBottom();

  try {
    const result = await $fetch<{
      reply: string;
      createdSkills: CreatedSkill[];
      completed: boolean;
    }>('/api/ability-skills/onboard', {
      method: 'POST',
      body: {
        message: text,
        history: history.value,
      },
    });

    messages.value.push({ role: 'assistant', content: result.reply });
    history.value.push({ role: 'assistant', content: result.reply });

    if (result.createdSkills && result.createdSkills.length > 0) {
      createdSkills.value.push(...result.createdSkills);
    }

    if (result.completed) {
      completed.value = true;
    }
  } catch (error) {
    messages.value.push({ role: 'assistant', content: '抱歉，暂时无法回复。请检查 LLM 配置。' });
  } finally {
    sending.value = false;
    scrollToBottom();
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}
</script>

<style scoped>
.onboarding-chat {
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

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md) 0;
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

.summary {
  align-self: flex-start;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.summary-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.summary-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.summary-item {
  font-size: 14px;
  color: var(--color-text-primary);
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
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
