<template>
  <div class="bookmarkList">
    <!-- 工具栏：搜索 + 排序 -->
    <div class="toolbar">
      <input
        v-model="searchInput"
        class="searchInput"
        type="text"
        placeholder="搜索文章..."
        @input="handleSearch"
      />
      <div class="sortGroup">
        <span class="sortLabel">排序:</span>
        <button
          class="sortBtn"
          :class="{ active: store.bookmarkSort === 'bookmarkedAt' }"
          @click="store.setBookmarkSort('bookmarkedAt')"
        >
          收藏时间
        </button>
        <button
          class="sortBtn"
          :class="{ active: store.bookmarkSort === 'publishedAt' }"
          @click="store.setBookmarkSort('publishedAt')"
        >
          发布时间
        </button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="store.bookmarksLoading && store.bookmarks.length === 0" class="loadingState">
      <div class="spinner" />
      <span>加载中...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="store.bookmarks.length === 0" class="emptyState">
      <p class="emptyTitle">
        {{ store.bookmarksSearch ? '没有找到匹配的文章' : '还没有收藏的文章' }}
      </p>
      <p class="emptyHint">
        {{ store.bookmarksSearch ? '试试其他关键词' : '阅读文章时点击收藏按钮即可添加' }}
      </p>
    </div>

    <!-- 卡片列表 -->
    <div v-else class="cardList">
      <BookmarkCard
        v-for="bookmark in store.bookmarks"
        :key="bookmark.id"
        :bookmark="bookmark"
        @open="handleOpen"
      />
    </div>

    <!-- 总数提示 -->
    <div v-if="store.bookmarks.length > 0" class="totalHint">
      共 {{ store.bookmarksTotal }} 篇收藏
    </div>
  </div>
</template>

<script setup lang="ts">
import BookmarkCard from './BookmarkCard.vue';

const store = useArticleReaderStore();
const searchInput = ref(store.bookmarksSearch);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    store.setBookmarksSearch(searchInput.value.trim());
  }, 300);
}

async function handleOpen(articleId: number) {
  try {
    await store.openBookmarkedArticle(articleId);
  } catch {
    // Error is stored in store.fetchError, reading view will show it
  }
}

onMounted(() => {
  store.loadBookmarks();
});
</script>

<style scoped>
.bookmarkList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.searchInput {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  outline: none;
  transition: border-color var(--transition-fast);
}

.searchInput:focus {
  border-color: var(--color-accent);
}

.searchInput::placeholder {
  color: var(--color-text-disabled);
}

.sortGroup {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.sortLabel {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.sortBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.sortBtn:hover {
  background-color: var(--color-bg-hover);
}

.sortBtn.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

/* 卡片列表 */
.cardList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* 加载状态 */
.loadingState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl) 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-xl) 0;
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

/* 总数 */
.totalHint {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-disabled);
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .searchInput {
    min-height: var(--touch-target-min);
  }
  .sortGroup {
    justify-content: flex-end;
  }
  .sortBtn {
    min-height: var(--touch-target-min);
    padding: var(--spacing-sm);
  }
}
</style>
