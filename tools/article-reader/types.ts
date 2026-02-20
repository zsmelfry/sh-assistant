// ===== 文章阅读器领域类型 =====

export interface Article {
  id: number;
  url: string;
  title: string;
  author: string | null;
  siteName: string | null;
  content: string;
  excerpt: string | null;
  publishedAt: number | null;
  createdAt: number;
}

export interface ArticleTranslation {
  id: number;
  articleId: number;
  type: TranslationType;
  content: string;
  providerId: number | null;
  createdAt: number;
}

export interface ArticleBookmark {
  id: number;
  articleId: number;
  notes: string | null;
  bookmarkedAt: number;
}

export type TranslationType = 'full' | 'summary';

export type TranslateMode = 'full' | 'summary' | 'both';

// ===== API 响应类型 =====

/** POST /api/articles/fetch 直接返回 Article（含可选 bookmark 字段） */
export interface ArticleWithBookmark extends Article {
  bookmark?: ArticleBookmark | null;
  tags?: { id: number; name: string; color: string | null }[];
}

/** GET /api/articles/:id/translations 返回按类型索引的翻译 */
export interface TranslationsResponse {
  full?: { content: string; cached: boolean } | null;
  summary?: { content: string; cached: boolean } | null;
}

/** POST /api/articles/:id/translate 返回 { [type]: { content, cached } } */
export type TranslateResponse = Record<string, { content: string; cached: boolean }>;

/** GET /api/bookmarks 返回嵌套结构 */
export interface BookmarkListItem {
  id: number;
  url: string;
  title: string;
  siteName: string | null;
  author: string | null;
  excerpt: string | null;
  publishedAt: number | null;
  bookmark: {
    id: number;
    bookmarkedAt: number;
    notes: string | null;
  };
  tags: { id: number; name: string; color: string | null }[];
}

export interface BookmarkListResponse {
  bookmarks: BookmarkListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  createdAt: number;
}

// ===== UI 类型 =====

export type ViewMode = 'reading' | 'bookmarks';

export type PanelTab = 'full' | 'summary' | 'notes' | 'chat';

export type BookmarkSortBy = 'bookmarkedAt' | 'publishedAt';

// ===== 聊天类型 =====

export interface ChatMessage {
  id: number;
  articleId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface ChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  meta: {
    provider: string;
    modelName: string;
    timestamp: string;
  };
}
