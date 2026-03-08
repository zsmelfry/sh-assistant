import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { skills } from './ability';

export const plannerDomains = sqliteTable('planner_domains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  year: integer('year').notNull().default(2026),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_planner_domains_sort').on(table.sortOrder),
  index('idx_planner_domains_year_sort').on(table.year, table.sortOrder),
]);

export const plannerGoals = sqliteTable('planner_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domainId: integer('domain_id').notNull()
    .references(() => plannerDomains.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority', { enum: ['high', 'medium', 'low'] })
    .notNull()
    .default('medium'),
  linkedAbilitySkillId: integer('linked_ability_skill_id')
    .references(() => skills.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_planner_goals_domain').on(table.domainId),
  index('idx_planner_goals_sort').on(table.domainId, table.sortOrder),
]);

export const plannerCheckitems = sqliteTable('planner_checkitems', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goalId: integer('goal_id').notNull()
    .references(() => plannerGoals.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  completedAt: integer('completed_at', { mode: 'number' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_planner_checkitems_goal').on(table.goalId),
  index('idx_planner_checkitems_sort').on(table.goalId, table.sortOrder),
  index('idx_planner_checkitems_completed_at').on(table.completedAt),
]);

export const plannerTags = sqliteTable('planner_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_planner_tags_name').on(table.name),
]);

export const plannerGoalTags = sqliteTable('planner_goal_tags', {
  goalId: integer('goal_id').notNull()
    .references(() => plannerGoals.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull()
    .references(() => plannerTags.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_planner_goal_tags_pk').on(table.goalId, table.tagId),
  index('idx_planner_goal_tags_tag').on(table.tagId),
]);

// 常量
export const VALID_PRIORITIES = ['high', 'medium', 'low'] as const;

