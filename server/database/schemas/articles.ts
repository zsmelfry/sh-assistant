import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { llmProviders } from './llm';

// ===== 文章主表 =====
export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').notNull(),
  title: text('title').notNull(),
  author: text('author'),
  siteName: text('site_name'),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  publishedAt: integer('published_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  lastReadAt: integer('last_read_at', { mode: 'number' }),  // 最后阅读时间（Unix ms）
}, (table) => [
  uniqueIndex('idx_articles_url').on(table.url),
  index('idx_articles_created_at').on(table.createdAt),
  index('idx_articles_last_read_at').on(table.lastReadAt),
]);

// ===== 翻译缓存表 =====
export const articleTranslations = sqliteTable('article_translations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleId: integer('article_id').notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),                    // 'full' | 'summary'
  content: text('content').notNull(),
  providerId: integer('provider_id')
    .references(() => llmProviders.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_article_translations_article_type').on(table.articleId, table.type),
  index('idx_article_translations_article_id').on(table.articleId),
]);

// ===== 收藏表 =====
export const articleBookmarks = sqliteTable('article_bookmarks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleId: integer('article_id').notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  notes: text('notes'),                            // 用户笔记（Markdown）
  bookmarkedAt: integer('bookmarked_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_article_bookmarks_article_id').on(table.articleId),
]);

// ===== 标签表 =====
export const articleTags = sqliteTable('article_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color'),                            // 颜色值（如 #FF6B6B）
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_article_tags_name').on(table.name),
]);

// ===== 文章-标签关联表 =====
export const articleTagMap = sqliteTable('article_tag_map', {
  articleId: integer('article_id').notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull()
    .references(() => articleTags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.articleId, table.tagId] }),
]);

// ===== 聊天记录表 =====
export const articleChats = sqliteTable('article_chats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleId: integer('article_id').notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),                    // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_article_chats_article_id').on(table.articleId),
  index('idx_article_chats_created_at').on(table.createdAt),
]);

// 类型推导
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type ArticleTranslation = typeof articleTranslations.$inferSelect;
export type NewArticleTranslation = typeof articleTranslations.$inferInsert;
export type ArticleBookmark = typeof articleBookmarks.$inferSelect;
export type NewArticleBookmark = typeof articleBookmarks.$inferInsert;
export type ArticleTag = typeof articleTags.$inferSelect;
export type NewArticleTag = typeof articleTags.$inferInsert;
export type ArticleTagMap = typeof articleTagMap.$inferSelect;
export type NewArticleTagMap = typeof articleTagMap.$inferInsert;
export type ArticleChat = typeof articleChats.$inferSelect;
export type NewArticleChat = typeof articleChats.$inferInsert;
