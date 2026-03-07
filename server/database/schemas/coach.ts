import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { skills, abilityCategories } from './ability';

// Coach profile — single row, persistent user portrait
export const coachProfile = sqliteTable('coach_profile', {
  id: integer('id').primaryKey().default(1),
  content: text('content').notNull().default(''),
  currentFocus: text('current_focus').notNull().default(''),
  version: integer('version').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

// Full conversation records
export const coachConversations = sqliteTable('coach_conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  context: text('context').notNull(),
  skillId: integer('skill_id')
    .references(() => skills.id, { onDelete: 'set null' }),
  messages: text('messages').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_coach_conv_context').on(table.context),
  index('idx_coach_conv_skill').on(table.skillId),
  index('idx_coach_conv_created').on(table.createdAt),
]);

// Conversation summaries / memories
export const coachMemories = sqliteTable('coach_memories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id')
    .references(() => coachConversations.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  skillTags: text('skill_tags').notNull().default('[]'),
  categoryTags: text('category_tags').notNull().default('[]'),
  memoryType: text('memory_type').notNull(),
  importance: integer('importance').notNull().default(3),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_coach_mem_type').on(table.memoryType),
  index('idx_coach_mem_importance').on(table.importance),
  index('idx_coach_mem_created').on(table.createdAt),
]);

// Proactive notifications
export const coachNotifications = sqliteTable('coach_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  priority: text('priority').notNull().default('medium'),
  skillId: integer('skill_id')
    .references(() => skills.id, { onDelete: 'set null' }),
  actionType: text('action_type'),
  actionUrl: text('action_url'),
  status: text('status').notNull().default('pending'),
  scheduledFor: integer('scheduled_for', { mode: 'number' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_coach_notif_status').on(table.status),
  index('idx_coach_notif_scheduled').on(table.scheduledFor),
  index('idx_coach_notif_type').on(table.type),
]);

// Profile change audit log
export const coachProfileChanges = sqliteTable('coach_profile_changes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  field: text('field').notNull(),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  reason: text('reason').notNull(),
  sourceConversationId: integer('source_conversation_id')
    .references(() => coachConversations.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
});

// Focus plans (max 3 active)
export const focusPlans = sqliteTable('focus_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  skillId: integer('skill_id').notNull()
    .references(() => skills.id, { onDelete: 'cascade' }),
  currentTier: integer('current_tier').notNull(),
  targetTier: integer('target_tier').notNull(),
  targetDate: text('target_date').notNull(),
  strategy: text('strategy'),
  linkedHabitIds: text('linked_habit_ids'),
  linkedPlannerGoalIds: text('linked_planner_goal_ids'),
  linkedSkillLearningIds: text('linked_skill_learning_ids'),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_focus_plans_status').on(table.status),
  index('idx_focus_plans_skill').on(table.skillId),
]);

// Badge definitions
export const badges = sqliteTable('badges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon'),
  rarity: text('rarity').notNull().default('common'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_badges_key').on(table.key),
]);

// User's awarded badges
export const badgeAwards = sqliteTable('badge_awards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  badgeId: integer('badge_id').notNull()
    .references(() => badges.id, { onDelete: 'cascade' }),
  skillId: integer('skill_id')
    .references(() => skills.id, { onDelete: 'set null' }),
  milestoneId: integer('milestone_id'),
  awardedAt: integer('awarded_at', { mode: 'number' }).notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_badge_awards_badge').on(table.badgeId),
  index('idx_badge_awards_skill').on(table.skillId),
]);
