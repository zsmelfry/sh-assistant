import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// 学习状态枚举值
export const LEARNING_STATUS = {
  UNREAD: 'unread',
  TO_LEARN: 'to_learn',
  LEARNING: 'learning',
  MASTERED: 'mastered',
} as const;

export type LearningStatus = typeof LEARNING_STATUS[keyof typeof LEARNING_STATUS];

// ===== 词汇表 =====
export const vocabWords = sqliteTable('vocab_words', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rank: integer('rank').notNull(),
  word: text('word').notNull(),
}, (table) => [
  index('idx_vocab_words_rank').on(table.rank),
]);

// ===== 用户表 =====
export const vocabUsers = sqliteTable('vocab_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nickname: text('nickname').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
});

// ===== 学习进度表 =====
export const vocabProgress = sqliteTable('vocab_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => vocabUsers.id, { onDelete: 'cascade' }),
  wordId: integer('word_id').notNull()
    .references(() => vocabWords.id, { onDelete: 'cascade' }),
  learningStatus: text('learning_status').notNull().default(LEARNING_STATUS.UNREAD),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  isMastered: integer('is_mastered', { mode: 'boolean' }).notNull().default(false),
  firstInteractedAt: integer('first_interacted_at', { mode: 'number' }),
  masteredAt: integer('mastered_at', { mode: 'number' }),
  note: text('note'),
}, (table) => [
  uniqueIndex('idx_vocab_progress_user_word').on(table.userId, table.wordId),
  index('idx_vocab_progress_user_id').on(table.userId),
  index('idx_vocab_progress_word_id').on(table.wordId),
  index('idx_vocab_progress_status').on(table.learningStatus),
]);

// ===== 设置表 =====
export const vocabSettings = sqliteTable('vocab_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

// ===== 状态变更历史 =====
export const vocabStatusHistory = sqliteTable('vocab_status_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => vocabUsers.id, { onDelete: 'cascade' }),
  wordId: integer('word_id').notNull()
    .references(() => vocabWords.id, { onDelete: 'cascade' }),
  previousStatus: text('previous_status').notNull(),
  newStatus: text('new_status').notNull(),
  changedAt: integer('changed_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_vocab_history_user_id').on(table.userId),
  index('idx_vocab_history_word_id').on(table.wordId),
  index('idx_vocab_history_user_word').on(table.userId, table.wordId),
  index('idx_vocab_history_changed_at').on(table.changedAt),
]);

// 类型推导
export type VocabWord = typeof vocabWords.$inferSelect;
export type NewVocabWord = typeof vocabWords.$inferInsert;
export type VocabUser = typeof vocabUsers.$inferSelect;
export type NewVocabUser = typeof vocabUsers.$inferInsert;
export type VocabProgress = typeof vocabProgress.$inferSelect;
export type NewVocabProgress = typeof vocabProgress.$inferInsert;
export type VocabSetting = typeof vocabSettings.$inferSelect;
export type VocabStatusHistory = typeof vocabStatusHistory.$inferSelect;
