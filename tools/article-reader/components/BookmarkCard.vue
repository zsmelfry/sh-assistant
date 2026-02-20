<template>
  <button class="bookmarkCard" @click="$emit('open', bookmark.id)">
    <div class="cardHeader">
      <h3 class="cardTitle">{{ bookmark.title }}</h3>
      <span class="cardDate">{{ formatDate(bookmark.bookmark.bookmarkedAt) }}</span>
    </div>

    <div v-if="bookmark.siteName || bookmark.author" class="cardMeta">
      <span v-if="bookmark.siteName">{{ bookmark.siteName }}</span>
      <span v-if="bookmark.author">{{ bookmark.author }}</span>
    </div>

    <p v-if="bookmark.excerpt" class="cardExcerpt">
      {{ bookmark.excerpt }}
    </p>
  </button>
</template>

<script setup lang="ts">
import type { BookmarkListItem } from '../types';

defineProps<{
  bookmark: BookmarkListItem;
}>();

defineEmits<{
  open: [articleId: number];
}>();

function formatDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;

  return new Date(ts).toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.bookmarkCard {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all var(--transition-fast);
}

.bookmarkCard:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-text-disabled);
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.cardTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  flex: 1;
  min-width: 0;
}

.cardDate {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.cardMeta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.cardMeta span:not(:last-child)::after {
  content: '\00B7';
  margin-left: var(--spacing-xs);
}

.cardExcerpt {
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 768px) {
  .bookmarkCard {
    min-height: var(--touch-target-min);
  }
}
</style>
