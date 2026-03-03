import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ===== 技能配置（DB驱动的技能定义） =====
export const skillConfigs = sqliteTable('skill_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  skillId: text('skill_id').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').notNull().default('BookOpen'),
  teachingSystemPrompt: text('teaching_system_prompt').notNull(),
  teachingUserPrompt: text('teaching_user_prompt').notNull(),
  chatSystemPrompt: text('chat_system_prompt').notNull(),
  taskSystemPrompt: text('task_system_prompt').notNull(),
  taskUserPrompt: text('task_user_prompt').notNull(),
  quizSystemPrompt: text('quiz_system_prompt').notNull().default(''),
  quizUserPrompt: text('quiz_user_prompt').notNull().default(''),
  guidanceSystemPrompt: text('guidance_system_prompt').notNull().default(''),
  guidanceUserPrompt: text('guidance_user_prompt').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(100),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

// ===== 类型推导 =====
export type SkillConfigRow = typeof skillConfigs.$inferSelect;
