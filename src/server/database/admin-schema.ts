import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// ── Admin DB: 仅认证 + 模块权限 ──

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  email: text('email'),
  tokenVersion: integer('token_version').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_users_username').on(table.username),
  uniqueIndex('idx_users_email').on(table.email),
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

export const loginLogs = sqliteTable('login_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  method: text('method', { enum: ['password', 'token', 'invite_setup', 'password_reset', 'admin_reset'] }).notNull(),
  ip: text('ip'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_login_logs_user_created').on(table.userId, table.createdAt),
]);

export const verificationTokens = sqliteTable('verification_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull(),
  type: text('type', { enum: ['invite', 'reset'] }).notNull(),
  role: text('role'),
  modules: text('modules'),
  expiresAt: integer('expires_at', { mode: 'number' }).notNull(),
  usedAt: integer('used_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_verification_tokens_hash').on(table.tokenHash),
  index('idx_verification_tokens_email_type').on(table.email, table.type),
  index('idx_verification_tokens_expires').on(table.expiresAt),
]);

// Type exports
export type User = typeof users.$inferSelect;
export type UserModule = typeof userModules.$inferSelect;
export type LoginLog = typeof loginLogs.$inferSelect;
export type VerificationToken = typeof verificationTokens.$inferSelect;
