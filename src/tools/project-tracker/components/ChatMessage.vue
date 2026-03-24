<template>
  <div class="chatMessage" :class="message.role">
    <div class="messageContent">{{ message.content }}</div>
    <div class="messageTime">{{ formatTime(message.createdAt) }}</div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '../types';

defineProps<{
  message: ChatMessage;
}>();

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.chatMessage {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  max-width: 85%;
  margin-bottom: var(--spacing-sm);
}

.chatMessage.user {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  margin-left: auto;
}

.chatMessage.assistant {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  margin-right: auto;
}

.messageContent {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.messageTime {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 2px;
  text-align: right;
}
</style>
