<template>
  <div class="bookmarkList">
    <!-- 工具栏：搜索 + 排序 -->
    <div class="toolbar">
      <div class="searchBox">
        <svg class="searchIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="searchInput"
          class="searchInput"
          type="text"
          placeholder="搜索文章..."
          @input="handleSearch"
        />
        <button
          v-if="searchInput"
          class="clearBtn"
          @click="clearSearch"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
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

    <!-- 标签筛选 + 管理 -->
    <div v-if="store.tags.length > 0 || showTagManager" class="tagSection">
      <div v-if="!showTagManager" class="tagFilterBar">
        <div class="tagChips">
          <button
            v-for="tag in store.tags"
            :key="tag.id"
            class="tagFilterChip"
            :class="{ active: store.selectedFilterTagIds.includes(tag.id) }"
            @click="store.toggleFilterTag(tag.id)"
          >
            <span class="tagDot" :style="{ backgroundColor: tag.color || '#999' }" />
            {{ tag.name }}
          </button>
        </div>
        <button class="manageTagsBtn" @click="showTagManager = true">管理标签</button>
      </div>

      <TagManager v-if="showTagManager" @close="showTagManager = false" />
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
import TagManager from './TagManager.vue';

const store = useArticleReaderStore();
const searchInput = ref(store.bookmarksSearch);
const showTagManager = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    store.setBookmarksSearch(searchInput.value.trim());
  }, 300);
}

function clearSearch() {
  searchInput.value = '';
  if (searchTimer) clearTimeout(searchTimer);
  store.setBookmarksSearch('');
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
  store.loadTags();
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

.searchBox {
  flex: 1;
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  transition: border-color var(--transition-fast);
}

.searchBox:focus-within {
  border-color: var(--color-accent);
}

.searchIcon {
  flex-shrink: 0;
  margin-left: var(--spacing-sm);
  color: var(--color-text-disabled);
}

.searchInput {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-sm);
  border: none;
  font-size: 14px;
  color: var(--color-text-primary);
  background: transparent;
  outline: none;
}

.searchInput::placeholder {
  color: var(--color-text-disabled);
}

.clearBtn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-right: var(--spacing-xs);
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.clearBtn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
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

/* 标签筛选 */
.tagSection {
  display: flex;
  flex-direction: column;
}

.tagFilterBar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.tagChips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  flex: 1;
}

.tagFilterChip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-bg-primary);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tagFilterChip:hover {
  background-color: var(--color-bg-hover);
}

.tagFilterChip.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.tagDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tagFilterChip.active .tagDot {
  border: 1px solid var(--color-accent-inverse);
}

.manageTagsBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.manageTagsBtn:hover {
  background-color: var(--color-bg-hover);
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
  .searchBox {
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
