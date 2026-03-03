import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// ===== 分类 =====
export const ptCategories = sqliteTable('pt_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_pt_categories_sort').on(table.sortOrder),
]);

// ===== 标签 =====
export const ptTags = sqliteTable('pt_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_pt_tags_name').on(table.name),
]);

// ===== 事项 =====
export const ptProjects = sqliteTable('pt_projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['idea', 'todo', 'in_progress', 'blocked', 'done', 'dropped'] })
    .notNull()
    .default('idea'),
  categoryId: integer('category_id').notNull()
    .references(() => ptCategories.id),
  dueDate: text('due_date'), // YYYY-MM-DD
  priority: text('priority', { enum: ['low', 'medium', 'high'] })
    .notNull()
    .default('medium'),
  blockedReason: text('blocked_reason'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_pt_projects_category').on(table.categoryId),
  index('idx_pt_projects_status').on(table.status),
  index('idx_pt_projects_archived').on(table.archived),
  index('idx_pt_projects_sort').on(table.sortOrder),
]);

// ===== 事项-标签 多对多 =====
export const ptProjectTags = sqliteTable('pt_project_tags', {
  projectId: integer('project_id').notNull()
    .references(() => ptProjects.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull()
    .references(() => ptTags.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_pt_project_tags_pk').on(table.projectId, table.tagId),
  index('idx_pt_project_tags_tag').on(table.tagId),
]);

// ===== 里程碑 =====
export const ptMilestones = sqliteTable('pt_milestones', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => ptProjects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dueDate: text('due_date'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_pt_milestones_project').on(table.projectId),
  index('idx_pt_milestones_sort').on(table.projectId, table.sortOrder),
]);

// ===== Checklist 任务项 =====
export const ptChecklistItems = sqliteTable('pt_checklist_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => ptProjects.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  completedAt: integer('completed_at', { mode: 'number' }),
  dueDate: text('due_date'),
  milestoneId: integer('milestone_id')
    .references(() => ptMilestones.id, { onDelete: 'set null' }),
  linkedNoteId: integer('linked_note_id'),
  linkedDiagramId: integer('linked_diagram_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_pt_checklist_project').on(table.projectId),
  index('idx_pt_checklist_milestone').on(table.milestoneId),
  index('idx_pt_checklist_sort').on(table.projectId, table.milestoneId, table.sortOrder),
]);

// ===== 笔记 =====
export const ptNotes = sqliteTable('pt_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => ptProjects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  aiSummary: text('ai_summary'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_pt_notes_project').on(table.projectId),
]);

// ===== 笔记附件 =====
export const ptAttachments = sqliteTable('pt_attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  noteId: integer('note_id').notNull()
    .references(() => ptNotes.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['url', 'image'] }).notNull(),
  url: text('url'),
  filePath: text('file_path'),
  caption: text('caption'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_pt_attachments_note').on(table.noteId),
]);

// ===== Diagram =====
export const ptDiagrams = sqliteTable('pt_diagrams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => ptProjects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: text('type').notNull().default('flowchart'),
  mermaidCode: text('mermaid_code').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_pt_diagrams_project').on(table.projectId),
]);

// ===== AI 对话 =====
export const ptChats = sqliteTable('pt_chats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => ptProjects.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_pt_chats_project').on(table.projectId),
]);

// ===== 提醒记录 =====
export const ptNotifications = sqliteTable('pt_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  targetType: text('target_type', { enum: ['project', 'checklist', 'milestone'] }).notNull(),
  targetId: integer('target_id').notNull(),
  remindType: text('remind_type', { enum: ['day_before', 'day_of'] }).notNull(),
  sentAt: integer('sent_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_pt_notifications_unique').on(table.targetType, table.targetId, table.remindType),
]);

// ===== 常量 =====
export const PT_STATUSES = ['idea', 'todo', 'in_progress', 'blocked', 'done', 'dropped'] as const;
export const PT_PRIORITIES = ['low', 'medium', 'high'] as const;
export const PT_ATTACHMENT_TYPES = ['url', 'image'] as const;
