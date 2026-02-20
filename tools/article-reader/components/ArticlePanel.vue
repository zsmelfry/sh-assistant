<template>
  <div class="articlePanel">
    <template v-if="article">
      <!-- 文章元信息 -->
      <header class="articleMeta">
        <h1 class="articleTitle">{{ article.title }}</h1>
        <div v-if="hasMeta" class="metaLine">
          <span v-if="article.siteName" class="metaItem">{{ article.siteName }}</span>
          <span v-if="article.author" class="metaItem">{{ article.author }}</span>
          <span v-if="article.publishedAt" class="metaItem">
            {{ formatDate(article.publishedAt) }}
          </span>
        </div>
      </header>

      <!-- 正文内容 -->
      <div class="articleContent" v-html="article.content" />
    </template>

    <!-- 空状态 -->
    <div v-else class="emptyState">
      <p class="emptyTitle">请输入文章 URL 开始阅读</p>
      <p class="emptyHint">支持大多数新闻、博客、技术文章网站</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Article } from '../types';

const props = defineProps<{
  article: Article | null;
}>();

const hasMeta = computed(() =>
  props.article?.siteName || props.article?.author || props.article?.publishedAt,
);

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.articlePanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

/* 元信息 */
.articleMeta {
  flex-shrink: 0;
  padding-bottom: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.articleTitle {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  margin-bottom: var(--spacing-sm);
}

.metaLine {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.metaItem:not(:last-child)::after {
  content: '\00B7';
  margin-left: var(--spacing-xs);
}

/* 正文内容 — 深度选择器覆盖 v-html 内部元素 */
.articleContent {
  flex: 1;
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-text-primary);
}

.articleContent :deep(h1),
.articleContent :deep(h2),
.articleContent :deep(h3),
.articleContent :deep(h4) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text-primary);
}

.articleContent :deep(h1) { font-size: 1.4em; }
.articleContent :deep(h2) { font-size: 1.25em; }
.articleContent :deep(h3) { font-size: 1.1em; }

.articleContent :deep(p) {
  margin-bottom: 1em;
}

.articleContent :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  margin: var(--spacing-md) 0;
}

.articleContent :deep(a) {
  color: var(--color-text-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.articleContent :deep(a:hover) {
  opacity: 0.7;
}

.articleContent :deep(blockquote) {
  margin: var(--spacing-md) 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border-left: 3px solid var(--color-border);
  color: var(--color-text-secondary);
}

.articleContent :deep(pre) {
  margin: var(--spacing-md) 0;
  padding: var(--spacing-md);
  background-color: var(--color-bg-sidebar);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

.articleContent :deep(code) {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

.articleContent :deep(:not(pre) > code) {
  padding: 1px 4px;
  background-color: var(--color-bg-sidebar);
  border-radius: 3px;
}

.articleContent :deep(ul),
.articleContent :deep(ol) {
  margin-bottom: 1em;
  padding-left: 1.5em;
}

.articleContent :deep(li) {
  margin-bottom: 0.3em;
}

.articleContent :deep(hr) {
  margin: var(--spacing-lg) 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

.articleContent :deep(table) {
  width: 100%;
  margin: var(--spacing-md) 0;
  border-collapse: collapse;
  font-size: 14px;
}

.articleContent :deep(th),
.articleContent :deep(td) {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  text-align: left;
}

.articleContent :deep(th) {
  background-color: var(--color-bg-sidebar);
  font-weight: 600;
}

.articleContent :deep(figure) {
  margin: var(--spacing-md) 0;
}

.articleContent :deep(figcaption) {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  margin-top: var(--spacing-xs);
}

/* 空状态 */
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  gap: var(--spacing-sm);
}

.emptyTitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.emptyHint {
  font-size: 14px;
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .articleTitle {
    font-size: 18px;
  }
  .articleContent {
    font-size: 14px;
  }
}
</style>
