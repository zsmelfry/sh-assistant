/**
 * Apply user schema migrations to all user DBs in data/users/.
 * Usage: npx tsx scripts/migrate-user-dbs.ts
 */
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../server/database/schema';

const DATA_DIR = process.env.DATA_DIR || './data';
const USERS_DIR = resolve(DATA_DIR, 'users');
const MIGRATIONS_DIR = resolve('./server/database/migrations');

if (!existsSync(USERS_DIR)) {
  console.log('[migrate-users] No data/users/ directory found. Skipping.');
  process.exit(0);
}

if (!existsSync(MIGRATIONS_DIR)) {
  console.log('[migrate-users] No migrations directory found. Skipping.');
  process.exit(0);
}

const dbFiles = readdirSync(USERS_DIR).filter((f) => f.endsWith('.db'));

if (dbFiles.length === 0) {
  console.log('[migrate-users] No user DBs found. Skipping.');
  process.exit(0);
}

for (const dbFile of dbFiles) {
  const dbPath = resolve(USERS_DIR, dbFile);
  console.log(`[migrate-users] Migrating ${dbFile}...`);

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });

  sqlite.close();
  console.log(`[migrate-users] ${dbFile} migrated successfully.`);
}

console.log(`[migrate-users] All ${dbFiles.length} user DBs migrated.`);
