import { defineStore } from 'pinia';
import type {
  Article,
  ArticleWithBookmark,
  BookmarkListItem,
  BookmarkSortBy,
  TranslationsResponse,
  TranslateResponse,
  BookmarkListResponse,
} from '~/tools/article-reader/types';

export const useArticleReaderStore = defineStore('article-reader', () => {
  // ===== 视图状态 =====
  const currentView = ref<'reading' | 'bookmarks'>('reading');

  // ===== 阅读状态 =====
  const currentArticle = ref<Article | null>(null);
  const translations = ref<{ full: string | null; summary: string | null }>({
    full: null,
    summary: null,
  });
  const isBookmarked = ref(false);
  const bookmarkId = ref<number | null>(null);
  const fetchLoading = ref(false);
  const fetchError = ref<string | null>(null);
  const translating = ref<{ full: boolean; summary: boolean }>({
    full: false,
    summary: false,
  });
  const bookmarkLoading = ref(false);

  // ===== 收藏库状态 =====
  const bookmarks = ref<BookmarkListItem[]>([]);
  const bookmarksTotal = ref(0);
  const bookmarksPage = ref(1);
  const bookmarksLimit = ref(20);
  const bookmarkSort = ref<BookmarkSortBy>('bookmarkedAt');
  const bookmarksSearch = ref('');
  const bookmarksLoading = ref(false);

  // ===== 阅读操作 =====

  // C2: API returns Article directly (with optional bookmark field), not { article }
  async function fetchArticle(url: string) {
    fetchLoading.value = true;
    fetchError.value = null;
    try {
      const res = await $fetch<ArticleWithBookmark>('/api/articles/fetch', {
        method: 'POST',
        body: { url },
      });
      currentArticle.value = res;
      translations.value = { full: null, summary: null };

      // C5: Extract bookmark status from article response instead of separate endpoint
      isBookmarked.value = !!res.bookmark;
      bookmarkId.value = res.bookmark?.id ?? null;

      await loadTranslations();
    } catch (e: any) {
      fetchError.value = e?.data?.message || e?.message || '文章加载失败，请检查链接是否正确';
      throw e;
    } finally {
      fetchLoading.value = false;
    }
  }

  // C3: API returns { full?: { content, cached }, summary?: { content, cached } }
  async function loadTranslations() {
    if (!currentArticle.value) return;
    try {
      const res = await $fetch<TranslationsResponse>(
        `/api/articles/${currentArticle.value.id}/translations`,
      );
      translations.value.full = res.full?.content ?? null;
      translations.value.summary = res.summary?.content ?? null;
    } catch {
      // Silently fail — translations are optional
    }
  }

  // C4: API returns { [type]: { content, cached } }
  async function translateArticle(type: 'full' | 'summary') {
    if (!currentArticle.value) return;
    translating.value[type] = true;
    try {
      const res = await $fetch<TranslateResponse>(
        `/api/articles/${currentArticle.value.id}/translate`,
        {
          method: 'POST',
          body: { type },
        },
      );
      translations.value[type] = res[type]?.content ?? null;
    } finally {
      translating.value[type] = false;
    }
  }

  // ===== 收藏操作 =====
  async function toggleBookmark() {
    if (!currentArticle.value) return;
    bookmarkLoading.value = true;
    try {
      if (isBookmarked.value) {
        await $fetch(`/api/articles/${currentArticle.value.id}/bookmark`, {
          method: 'DELETE',
        });
        isBookmarked.value = false;
        bookmarkId.value = null;
      } else {
        const res = await $fetch<{ id: number }>(
          `/api/articles/${currentArticle.value.id}/bookmark`,
          { method: 'POST' },
        );
        isBookmarked.value = true;
        bookmarkId.value = res.id;
      }
    } finally {
      bookmarkLoading.value = false;
    }
  }

  // ===== 收藏库操作 =====

  // H2: Use `limit` and `sort` instead of `pageSize` and `sortBy`
  async function loadBookmarks() {
    bookmarksLoading.value = true;
    try {
      const res = await $fetch<BookmarkListResponse>('/api/bookmarks', {
        params: {
          page: bookmarksPage.value,
          limit: bookmarksLimit.value,
          sort: bookmarkSort.value,
          search: bookmarksSearch.value || undefined,
        },
      });
      bookmarks.value = res.bookmarks;
      bookmarksTotal.value = res.total;
    } finally {
      bookmarksLoading.value = false;
    }
  }

  async function openBookmarkedArticle(articleId: number) {
    fetchLoading.value = true;
    fetchError.value = null;
    try {
      const res = await $fetch<ArticleWithBookmark>(`/api/articles/${articleId}`);
      currentArticle.value = res;
      translations.value = { full: null, summary: null };
      isBookmarked.value = !!res.bookmark;
      bookmarkId.value = res.bookmark?.id ?? null;
      currentView.value = 'reading';

      await loadTranslations();
    } catch (e: any) {
      fetchError.value = e?.data?.message || e?.message || '文章加载失败';
      throw e;
    } finally {
      fetchLoading.value = false;
    }
  }

  function setBookmarkSort(sortBy: BookmarkSortBy) {
    bookmarkSort.value = sortBy;
    bookmarksPage.value = 1;
    loadBookmarks();
  }

  function setBookmarksSearch(query: string) {
    bookmarksSearch.value = query;
    bookmarksPage.value = 1;
    loadBookmarks();
  }

  return {
    // 视图状态
    currentView,
    // 阅读状态
    currentArticle, translations, isBookmarked, bookmarkId,
    fetchLoading, fetchError, translating, bookmarkLoading,
    // 收藏库状态
    bookmarks, bookmarksTotal, bookmarksPage, bookmarksLimit,
    bookmarkSort, bookmarksSearch, bookmarksLoading,
    // 阅读操作
    fetchArticle, loadTranslations, translateArticle,
    // 收藏操作
    toggleBookmark,
    // 收藏库操作
    loadBookmarks, openBookmarkedArticle, setBookmarkSort, setBookmarksSearch,
  };
});
