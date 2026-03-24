<template>
  <BaseChatPanel
    :messages="store.chatMessages"
    :loading="store.chatLoading"
    :error="store.chatError"
    empty-title="AI 文章助手"
    empty-hint="针对当前文章提问，获得 AI 解答"
    @send="store.sendChatMessage($event)"
    @clear="store.clearChat()"
  />
</template>

<script setup lang="ts">
const store = useArticleReaderStore();

onMounted(() => {
  store.loadChatHistory();
});
</script>
