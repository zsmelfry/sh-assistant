import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// 7 ability categories — radar chart dimensions, system-preset, immutable
export const abilityCategories = sqliteTable('ability_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
});

// User's concrete skills
export const skills = sqliteTable('skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoryId: integer('category_id').notNull()
    .references(() => abilityCategories.id),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  source: text('source', { enum: ['template', 'ai', 'custom', 'system'] }).notNull(),
  templateId: text('template_id'),
  currentTier: integer('current_tier').notNull().default(0),
  status: text('status', { enum: ['active', 'paused'] }).notNull().default('active'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_skills_category').on(table.categoryId),
  index('idx_skills_status').on(table.status),
  index('idx_skills_template').on(table.templateId),
]);

// Milestones within a skill
export const milestones = sqliteTable('milestones', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  skillId: integer('skill_id').notNull()
    .references(() => skills.id, { onDelete: 'cascade' }),
  tier: integer('tier').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  milestoneType: text('milestone_type', { enum: ['quantity', 'consistency', 'achievement', 'quality'] }).notNull(),
  verifyMethod: text('verify_method', { enum: ['platform_auto', 'platform_test', 'evidence', 'self_declare'] }).notNull(),
  verifyConfig: text('verify_config'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_milestones_skill').on(table.skillId),
  index('idx_milestones_skill_tier').on(table.skillId, table.tier),
]);

// Milestone completion records
export const milestoneCompletions = sqliteTable('milestone_completions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  milestoneId: integer('milestone_id').notNull()
    .references(() => milestones.id, { onDelete: 'cascade' }),
  verifyMethod: text('verify_method').notNull(),
  evidenceUrl: text('evidence_url'),
  evidenceNote: text('evidence_note'),
  verifiedAt: integer('verified_at', { mode: 'number' }).notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_milestone_completions_milestone').on(table.milestoneId),
]);

// Skill current state — distinct from historical achievements
export const skillCurrentState = sqliteTable('skill_current_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  skillId: integer('skill_id').notNull()
    .references(() => skills.id, { onDelete: 'cascade' }),
  stateKey: text('state_key').notNull(),
  stateValue: text('state_value').notNull(),
  stateLabel: text('state_label').notNull(),
  source: text('source', { enum: ['platform_auto', 'user_confirmed'] }).notNull(),
  confirmedAt: integer('confirmed_at', { mode: 'number' }).notNull(),
  expiresAfterDays: integer('expires_after_days').notNull().default(180),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_skill_state_skill').on(table.skillId),
  uniqueIndex('idx_skill_state_skill_key').on(table.skillId, table.stateKey),
]);

// Monthly radar snapshots
export const skillSnapshots = sqliteTable('skill_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  radarData: text('radar_data').notNull(),
  skillData: text('skill_data').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_skill_snapshots_date').on(table.date),
]);

// Activity logs from various modules + manual entries
export const activityLogs = sqliteTable('activity_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  skillId: integer('skill_id')
    .references(() => skills.id, { onDelete: 'set null' }),
  categoryId: integer('category_id')
    .references(() => abilityCategories.id, { onDelete: 'set null' }),
  source: text('source').notNull(),
  sourceRef: text('source_ref'),
  description: text('description').notNull(),
  date: text('date').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_activity_logs_skill').on(table.skillId),
  index('idx_activity_logs_date').on(table.date),
  index('idx_activity_logs_source').on(table.source),
  index('idx_activity_logs_category').on(table.categoryId),
]);

// Tier name constants
export const TIER_NAMES: Record<number, string> = {
  0: '未开始',
  1: '入门',
  2: '基础',
  3: '胜任',
  4: '精通',
  5: '卓越',
};

export const VALID_SOURCES = ['template', 'ai', 'custom', 'system'] as const;
export const VALID_SKILL_STATUSES = ['active', 'paused'] as const;
export const VALID_MILESTONE_TYPES = ['quantity', 'consistency', 'achievement', 'quality'] as const;
export const VALID_VERIFY_METHODS = ['platform_auto', 'platform_test', 'evidence', 'self_declare'] as const;
