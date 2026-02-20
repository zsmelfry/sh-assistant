import { defineStore } from 'pinia';
import type {
  Article,
  ArticleWithBookmark,
  BookmarkListItem,
  BookmarkSortBy,
  TranslationsResponse,
  TranslateResponse,
  BookmarkListResponse,
  Tag,
  ChatMessage,
  ChatResponse,
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
  const notes = ref('');
  const notesSaving = ref(false);
  const articleTagIds = ref<number[]>([]);

  // ===== 标签状态 =====
  const tags = ref<Tag[]>([]);
  const selectedFilterTagIds = ref<number[]>([]);

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
      notes.value = res.bookmark?.notes || '';
      articleTagIds.value = (res.tags || []).map(t => t.id);
      chatMessages.value = [];
      chatError.value = null;

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
        notes.value = '';
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

  async function saveNotes(content: string) {
    if (!currentArticle.value || !isBookmarked.value) return;
    notesSaving.value = true;
    try {
      await $fetch(`/api/articles/${currentArticle.value.id}/bookmark`, {
        method: 'PATCH',
        body: { notes: content },
      });
      notes.value = content;
    } finally {
      notesSaving.value = false;
    }
  }

  // ===== 标签操作 =====

  async function loadTags() {
    tags.value = await $fetch<Tag[]>('/api/article-tags');
  }

  async function createTag(name: string, color?: string) {
    const tag = await $fetch<Tag>('/api/article-tags', {
      method: 'POST',
      body: { name, color: color || null },
    });
    tags.value = [...tags.value, tag].sort((a, b) => a.name.localeCompare(b.name));
    return tag;
  }

  async function updateTag(id: number, data: { name?: string; color?: string | null }) {
    const tag = await $fetch<Tag>(`/api/article-tags/${id}`, {
      method: 'PATCH',
      body: data,
    });
    tags.value = tags.value.map(t => t.id === id ? tag : t);
    return tag;
  }

  async function deleteTag(id: number) {
    await $fetch(`/api/article-tags/${id}`, { method: 'DELETE' });
    tags.value = tags.value.filter(t => t.id !== id);
    selectedFilterTagIds.value = selectedFilterTagIds.value.filter(tid => tid !== id);
  }

  async function setArticleTags(articleId: number, tagIds: number[]) {
    const result = await $fetch<Tag[]>(`/api/articles/${articleId}/tags`, {
      method: 'PUT',
      body: { tagIds },
    });
    articleTagIds.value = result.map(t => t.id);
    return result;
  }

  // ===== 聊天状态 =====
  const chatMessages = ref<ChatMessage[]>([]);
  const chatLoading = ref(false);
  const chatError = ref<string | null>(null);

  // ===== 聊天操作 =====

  async function loadChatHistory() {
    if (!currentArticle.value) return;
    try {
      chatMessages.value = await $fetch<ChatMessage[]>(
        `/api/articles/${currentArticle.value.id}/chats`,
      );
    } catch {
      chatMessages.value = [];
    }
  }

  async function sendChatMessage(message: string) {
    if (!currentArticle.value || !message.trim()) return;
    chatLoading.value = true;
    chatError.value = null;

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: -Date.now(),
      articleId: currentArticle.value.id,
      role: 'user',
      content: message.trim(),
      createdAt: Date.now(),
    };
    chatMessages.value = [...chatMessages.value, tempUserMsg];

    try {
      const res = await $fetch<ChatResponse>(
        `/api/articles/${currentArticle.value.id}/chat`,
        {
          method: 'POST',
          body: { message: message.trim() },
        },
      );
      // Replace temp message with real one and add assistant response
      chatMessages.value = [
        ...chatMessages.value.filter(m => m.id !== tempUserMsg.id),
        res.userMessage,
        res.assistantMessage,
      ];
    } catch (e: any) {
      // Remove temp message on error
      chatMessages.value = chatMessages.value.filter(m => m.id !== tempUserMsg.id);
      chatError.value = e?.data?.message || e?.message || 'AI 回复失败';
    } finally {
      chatLoading.value = false;
    }
  }

  async function clearChat() {
    if (!currentArticle.value) return;
    try {
      await $fetch(`/api/articles/${currentArticle.value.id}/chats`, {
        method: 'DELETE',
      });
      chatMessages.value = [];
    } catch {
      // Silently fail
    }
  }

  function toggleFilterTag(tagId: number) {
    const idx = selectedFilterTagIds.value.indexOf(tagId);
    if (idx === -1) {
      selectedFilterTagIds.value = [...selectedFilterTagIds.value, tagId];
    } else {
      selectedFilterTagIds.value = selectedFilterTagIds.value.filter(id => id !== tagId);
    }
    bookmarksPage.value = 1;
    loadBookmarks();
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
          tagIds: selectedFilterTagIds.value.length > 0
            ? selectedFilterTagIds.value.join(',')
            : undefined,
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
      notes.value = res.bookmark?.notes || '';
      articleTagIds.value = (res.tags || []).map(t => t.id);
      chatMessages.value = [];
      chatError.value = null;
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
    notes, notesSaving,
    // 标签状态
    tags, selectedFilterTagIds, articleTagIds,
    // 收藏库状态
    bookmarks, bookmarksTotal, bookmarksPage, bookmarksLimit,
    bookmarkSort, bookmarksSearch, bookmarksLoading,
    // 阅读操作
    fetchArticle, loadTranslations, translateArticle,
    // 收藏操作
    toggleBookmark, saveNotes,
    // 标签操作
    loadTags, createTag, updateTag, deleteTag, setArticleTags, toggleFilterTag,
    // 聊天状态
    chatMessages, chatLoading, chatError,
    // 聊天操作
    loadChatHistory, sendChatMessage, clearChat,
    // 收藏库操作
    loadBookmarks, openBookmarkedArticle, setBookmarkSort, setBookmarksSearch,
  };
});
