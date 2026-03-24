import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { skills } from './ability';

export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly'] })
    .notNull()
    .default('daily'),
  linkedAbilitySkillId: integer('linked_ability_skill_id')
    .references(() => skills.id, { onDelete: 'set null' }),
  archived: integer('archived', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_habits_archived').on(table.archived),
]);

export const checkins = sqliteTable('checkins', {
  id: text('id').primaryKey(),
  habitId: text('habit_id').notNull()
    .references(() => habits.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_checkins_habit_date').on(table.habitId, table.date),
  index('idx_checkins_habit_id').on(table.habitId),
]);

// 常量
export const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

