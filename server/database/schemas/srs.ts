import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { vocabUsers, vocabWords } from './vocab';

// ===== SRS 卡片表 =====
export const srsCards = sqliteTable('srs_cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => vocabUsers.id, { onDelete: 'cascade' }),
  wordId: integer('word_id').notNull()
    .references(() => vocabWords.id, { onDelete: 'cascade' }),
  easeFactor: real('ease_factor').notNull().default(2.5),
  interval: integer('interval').notNull().default(0),          // 天
  repetitions: integer('repetitions').notNull().default(0),
  nextReviewAt: integer('next_review_at', { mode: 'number' }).notNull(),
  lastReviewedAt: integer('last_reviewed_at', { mode: 'number' }),
}, (table) => [
  uniqueIndex('idx_srs_cards_user_word').on(table.userId, table.wordId),
  index('idx_srs_cards_user_id').on(table.userId),
  index('idx_srs_cards_next_review').on(table.nextReviewAt),
]);

// ===== 复习日志表 =====
export const reviewLogs = sqliteTable('review_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => vocabUsers.id, { onDelete: 'cascade' }),
  wordId: integer('word_id').notNull()
    .references(() => vocabWords.id, { onDelete: 'cascade' }),
  srsCardId: integer('srs_card_id').notNull()
    .references(() => srsCards.id, { onDelete: 'cascade' }),
  quality: integer('quality').notNull(),          // 0-5
  previousInterval: integer('previous_interval').notNull(),
  newInterval: integer('new_interval').notNull(),
  previousEaseFactor: real('previous_ease_factor').notNull(),
  newEaseFactor: real('new_ease_factor').notNull(),
  reviewedAt: integer('reviewed_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_review_logs_user_id').on(table.userId),
  index('idx_review_logs_card_id').on(table.srsCardId),
  index('idx_review_logs_reviewed_at').on(table.reviewedAt),
]);

// ===== 学习会话表 =====
export const studySessions = sqliteTable('study_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => vocabUsers.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),                   // YYYY-MM-DD
  newWordsStudied: integer('new_words_studied').notNull().default(0),
  reviewsCompleted: integer('reviews_completed').notNull().default(0),
  startedAt: integer('started_at', { mode: 'number' }).notNull(),
  completedAt: integer('completed_at', { mode: 'number' }),
}, (table) => [
  uniqueIndex('idx_study_sessions_user_date').on(table.userId, table.date),
  index('idx_study_sessions_user_id').on(table.userId),
]);

// ===== 释义缓存表 =====
export const definitions = sqliteTable('definitions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wordId: integer('word_id').notNull()
    .references(() => vocabWords.id, { onDelete: 'cascade' }),
  definition: text('definition').notNull(),
  partOfSpeech: text('part_of_speech').notNull().default(''),
  example: text('example').notNull().default(''),
  exampleTranslation: text('example_translation').notNull().default(''),
  examples: text('examples').default('[]'),       // JSON: [{"sentence":"...","translation":"..."}]
  synonyms: text('synonyms').notNull().default(''),
  antonyms: text('antonyms').notNull().default(''),
  wordFamily: text('word_family').notNull().default(''),
  collocations: text('collocations').notNull().default(''),
  fetchedAt: integer('fetched_at', { mode: 'number' }).notNull(),
  modelProvider: text('model_provider').notNull().default(''),
  modelName: text('model_name').notNull().default(''),
}, (table) => [
  index('idx_definitions_word_id').on(table.wordId),
]);

// 类型推导
export type SrsCard = typeof srsCards.$inferSelect;
export type ReviewLog = typeof reviewLogs.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type Definition = typeof definitions.$inferSelect;
