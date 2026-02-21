<template>
  <BaseChatPanel
    :messages="store.chats"
    :loading="store.chatSending"
    :error="store.chatError"
    empty-title="AI 创业导师"
    empty-hint="问我任何关于这个知识点的问题"
    @send="store.sendChat(props.pointId, $event)"
    @clear="store.clearChats(props.pointId)"
  />
</template>

<script setup lang="ts">
const props = defineProps<{
  pointId: number;
}>();

const store = useStartupMapStore();

onMounted(() => {
  store.loadChats(props.pointId);
});

watch(() => props.pointId, (id) => {
  store.loadChats(id);
});
</script>
