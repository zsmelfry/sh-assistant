import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ── Admin DB: 仅认证 + 模块权限 ──

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_users_username').on(table.username),
]);

export const userModules = sqliteTable('user_modules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  moduleId: text('module_id').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_user_modules_unique').on(table.userId, table.moduleId),
]);

// Type exports
export type User = typeof users.$inferSelect;
export type UserModule = typeof userModules.$inferSelect;
