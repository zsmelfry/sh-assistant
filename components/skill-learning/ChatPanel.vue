<template>
  <BaseChatPanel
    :messages="allMessages"
    :loading="store.chatSending"
    :error="store.chatError"
    empty-title="AI 学习导师"
    empty-hint="问我任何关于这个知识点的问题"
    @send="handleSend"
    @clear="handleClear"
  >
    <template #above-input>
      <QuickQuestions
        v-if="showQuickButtons"
        :buttons="store.guidance?.quickButtons || []"
        :loading="store.guidanceLoading"
        @select="handleQuickQuestion"
      />
    </template>
  </BaseChatPanel>
</template>

<script setup lang="ts">
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import type { SmChat } from '~/composables/skill-learning/types';
import QuickQuestions from './QuickQuestions.vue';

const props = defineProps<{
  pointId: number;
}>();

const store = inject(SKILL_STORE_KEY)!;

// Virtual guidance message (not persisted)
const virtualGuidance = ref<SmChat | null>(null);

// Show quick buttons only when there are no real user messages
const showQuickButtons = computed(() => {
  const hasUserMessage = store.chats.some(m => m.role === 'user');
  return !hasUserMessage && (store.guidance?.quickButtons?.length || store.guidanceLoading);
});

// Combine virtual guidance with real chats
const allMessages = computed(() => {
  const msgs: SmChat[] = [];
  if (virtualGuidance.value && store.chats.length === 0) {
    msgs.push(virtualGuidance.value);
  }
  msgs.push(...store.chats);
  return msgs;
});

// Watch for guidance to load and create virtual message
watch(() => store.guidance, (g) => {
  if (g && g.guidingQuestions.length > 0 && store.chats.length === 0) {
    const content = g.guidingQuestions
      .map(q => `**思考一下：** ${q}`)
      .join('\n\n');
    virtualGuidance.value = {
      id: -1,
      pointId: props.pointId,
      role: 'assistant',
      content,
      createdAt: Date.now(),
    };
  }
}, { immediate: true });

// Clear virtual guidance when real chats arrive
watch(() => store.chats.length, (len) => {
  if (len > 0) {
    virtualGuidance.value = null;
  }
});

function handleSend(message: string) {
  virtualGuidance.value = null;
  store.sendChat(props.pointId, message);
}

function handleClear() {
  store.clearChats(props.pointId);
  // Restore guidance after clearing
  if (store.guidance?.guidingQuestions.length) {
    const content = store.guidance.guidingQuestions
      .map(q => `**思考一下：** ${q}`)
      .join('\n\n');
    virtualGuidance.value = {
      id: -1,
      pointId: props.pointId,
      role: 'assistant',
      content,
      createdAt: Date.now(),
    };
  }
}

function handleQuickQuestion(prompt: string) {
  virtualGuidance.value = null;
  store.sendChat(props.pointId, prompt);
}

onMounted(() => {
  store.loadChats(props.pointId);
});

watch(() => props.pointId, (id) => {
  virtualGuidance.value = null;
  store.loadChats(id);
});
</script>
