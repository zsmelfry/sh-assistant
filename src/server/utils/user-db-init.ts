import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from '~/server/database/schema';
import { getDataDir } from '~/server/utils/data-dir';

/**
 * Initialize a new user's database.
 * Creates the DB file and applies all user schema migrations.
 */
export function initUserDB(username: string): void {
  // Validate username
  if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
    throw new Error(`Invalid username: ${username}`);
  }

  const dbPath = resolve(getDataDir(), 'users', `${username}.db`);
  const usersDir = resolve(getDataDir(), 'users');
  if (!dbPath.startsWith(usersDir + '/')) {
    throw new Error('Invalid DB path');
  }

  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });

  // Apply all user schema migrations
  const migrationsFolder = resolve('./src/server/database/migrations');
  if (existsSync(migrationsFolder)) {
    migrate(db, { migrationsFolder });
  }

  // Clean up: remove users table from user DB (auth lives in admin.db)
  try {
    sqlite.exec('DROP TABLE IF EXISTS users');
  } catch { /* may not exist */ }

  sqlite.close();
}
