<template>
  <div class="linkedArticles">
    <div class="sectionHeader">
      <h3 class="sectionTitle">关联文章</h3>
      <button class="addBtn" @click="showPicker = true">添加关联</button>
    </div>

    <!-- Loading -->
    <div v-if="store.linkedArticlesLoading" class="loadingState">加载中...</div>

    <!-- Article list -->
    <div v-else-if="store.linkedArticles.length > 0" class="articleList">
      <div
        v-for="article in store.linkedArticles"
        :key="article.articleId"
        class="articleItem"
      >
        <div class="articleInfo" @click="goToArticle(article)">
          <span class="articleTitle">{{ article.title }}</span>
          <span v-if="article.siteName" class="articleMeta">{{ article.siteName }}</span>
        </div>
        <button
          class="unlinkBtn"
          title="取消关联"
          @click="handleUnlink(article.articleId)"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Empty -->
    <p v-else class="emptyHint">暂无关联文章</p>

    <!-- Article picker modal -->
    <ArticlePicker
      v-if="showPicker"
      :point-id="pointId"
      :existing-ids="existingArticleIds"
      @close="showPicker = false"
      @confirm="handleLink"
    />
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import type { LinkedArticle } from '~/composables/skill-learning/types';
import ArticlePicker from './ArticlePicker.vue';

const props = defineProps<{
  pointId: number;
}>();

const store = inject(SKILL_STORE_KEY)!;
const showPicker = ref(false);

const existingArticleIds = computed(() =>
  new Set(store.linkedArticles.map(a => a.articleId)),
);

onMounted(() => {
  store.loadPointArticles(props.pointId);
});

watch(() => props.pointId, (id) => {
  store.loadPointArticles(id);
});

function goToArticle(article: LinkedArticle) {
  // Navigate to article-reader tool with the article
  navigateTo(`/article-reader?articleId=${article.articleId}`);
}

async function handleLink(articleIds: number[]) {
  showPicker.value = false;
  await store.linkArticles(props.pointId, articleIds);
}

function handleUnlink(articleId: number) {
  store.unlinkArticle(props.pointId, articleId);
}
</script>

<style scoped>
.linkedArticles {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.sectionHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.addBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.addBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.loadingState {
  text-align: center;
  padding: var(--spacing-sm);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.articleList {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.articleItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
}

.articleItem:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.articleInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  cursor: pointer;
}

.articleInfo:hover .articleTitle {
  text-decoration: underline;
}

.articleTitle {
  font-size: 14px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.articleMeta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.unlinkBtn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-disabled);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.unlinkBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.emptyHint {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--spacing-sm);
}

@media (max-width: 768px) {
  .articleItem {
    min-height: var(--touch-target-min);
  }
}
</style>
