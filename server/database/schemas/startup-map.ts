import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { articles } from './articles';

// ===== 产品档案 =====
export const smProducts = sqliteTable('sm_products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  targetMarket: text('target_market'),
  targetCustomer: text('target_customer'),
  productionSource: text('production_source'),
  currentStage: text('current_stage', { enum: ['ideation', 'researching', 'preparing', 'launched'] })
    .default('ideation'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

// ===== 领域 =====
export const smDomains = sqliteTable('sm_domains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  skillId: text('skill_id').notNull().default('startup-map'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_domains_sort').on(table.sortOrder),
  index('idx_sm_domains_skill').on(table.skillId),
]);

// ===== 主题 =====
export const smTopics = sqliteTable('sm_topics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domainId: integer('domain_id').notNull()
    .references(() => smDomains.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_topics_domain').on(table.domainId),
  index('idx_sm_topics_sort').on(table.domainId, table.sortOrder),
]);

// ===== 知识点 =====
export const smPoints = sqliteTable('sm_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topicId: integer('topic_id').notNull()
    .references(() => smTopics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['not_started', 'learning', 'understood', 'practiced'] })
    .notNull()
    .default('not_started'),
  statusUpdatedAt: integer('status_updated_at', { mode: 'number' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_points_topic').on(table.topicId),
  index('idx_sm_points_status').on(table.status),
  index('idx_sm_points_sort').on(table.topicId, table.sortOrder),
]);

// ===== 教学内容（单行 5 列） =====
export const smTeachings = sqliteTable('sm_teachings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  what: text('what'),
  how: text('how'),
  example: text('example'),
  apply: text('apply'),
  resources: text('resources'),
  productId: integer('product_id')
    .references(() => smProducts.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_sm_teachings_point').on(table.pointId),
]);

// ===== AI 对话记录 =====
export const smChats = sqliteTable('sm_chats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),           // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_chats_point').on(table.pointId),
  index('idx_sm_chats_created_at').on(table.createdAt),
]);

// ===== P1: 学习阶段 =====
export const smStages = sqliteTable('sm_stages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  objective: text('objective'),
  sortOrder: integer('sort_order').notNull().default(0),
  skillId: text('skill_id').notNull().default('startup-map'),
}, (table) => [
  index('idx_sm_stages_skill').on(table.skillId),
]);

// ===== P1: 阶段-知识点多对多映射 =====
export const smStagePoints = sqliteTable('sm_stage_points', {
  stageId: integer('stage_id').notNull()
    .references(() => smStages.id, { onDelete: 'cascade' }),
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.stageId, table.pointId] }),
]);

// ===== P1: 实践任务 =====
export const smTasks = sqliteTable('sm_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  expectedOutput: text('expected_output'),
  hint: text('hint'),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  completionNote: text('completion_note'),
  completedAt: integer('completed_at', { mode: 'number' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_tasks_point').on(table.pointId),
]);

// ===== P1: 知识点笔记 =====
export const smNotes = sqliteTable('sm_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .references(() => smProducts.id, { onDelete: 'set null' }),
  content: text('content').notNull().default(''),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_sm_notes_point_product').on(table.pointId, table.productId),
]);

// ===== P2: 知识点-文章关联 =====
export const smPointArticles = sqliteTable('sm_point_articles', {
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  articleId: integer('article_id').notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.pointId, table.articleId] }),
]);

// ===== P2: 学习行为记录 =====
export const smActivities = sqliteTable('sm_activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id')
    .references(() => smPoints.id, { onDelete: 'set null' }),
  type: text('type', { enum: ['view', 'chat', 'note', 'task', 'status_change', 'quiz'] }).notNull(),
  skillId: text('skill_id').notNull().default('startup-map'),
  date: text('date').notNull(),   // 'YYYY-MM-DD'
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_activities_date').on(table.date),
  index('idx_sm_activities_point').on(table.pointId),
  index('idx_sm_activities_skill').on(table.skillId),
]);

// ===== 理解测验 =====
export const smQuizzes = sqliteTable('sm_quizzes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  section: text('section', { enum: ['what', 'how', 'example', 'apply', 'resources'] }).notNull(),
  type: text('type', { enum: ['multiple_choice', 'true_false', 'fill_blank', 'audio_choice'] }).notNull(),
  question: text('question').notNull(),
  options: text('options'),       // JSON stringified array for multiple choice
  correctAnswer: text('correct_answer').notNull(),
  explanation: text('explanation'),
  audioSpec: text('audio_spec'),  // JSON: { type, notes[], simultaneous? }
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_quizzes_point_section').on(table.pointId, table.section),
]);

// ===== 测验记录 =====
export const smQuizAttempts = sqliteTable('sm_quiz_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quizId: integer('quiz_id').notNull()
    .references(() => smQuizzes.id, { onDelete: 'cascade' }),
  userAnswer: text('user_answer').notNull(),
  isCorrect: integer('is_correct', { mode: 'boolean' }).notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_quiz_attempts_quiz').on(table.quizId),
]);

