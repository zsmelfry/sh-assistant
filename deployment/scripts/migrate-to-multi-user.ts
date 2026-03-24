/**
 * One-time migration: split single assistant.db into admin.db + per-user DBs.
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx tsx scripts/migrate-to-multi-user.ts
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync, copyFileSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import * as adminSchema from '../server/database/admin-schema';
import * as userSchema from '../server/database/schema';

const DATA_DIR = process.env.DATA_DIR || './data';
const STATE_FILE = resolve(DATA_DIR, '.migration-state');
const ASSISTANT_DB_PATH = process.env.DATABASE_PATH || resolve(DATA_DIR, 'assistant.db');
const ADMIN_DB_PATH = process.env.ADMIN_DB_PATH || resolve(DATA_DIR, 'admin.db');

// All module IDs that can be managed
const ALL_MODULE_IDS = [
  'dashboard',
  'ability-profile',
  'habit-tracker',
  'annual-planner',
  'vocab-tracker',
  'article-reader',
  'project-tracker',
  'skill-manager',
  'xiaoshuang',
];

function log(msg: string) {
  console.log(`[migrate] ${msg}`);
}

function main() {
  // Check idempotency
  if (existsSync(STATE_FILE)) {
    const state = readFileSync(STATE_FILE, 'utf-8');
    if (state.includes('completed')) {
      log('Migration already completed. Skipping.');
      return;
    }
  }

  // Check source DB exists
  if (!existsSync(ASSISTANT_DB_PATH)) {
    log(`Source DB not found at ${ASSISTANT_DB_PATH}. Nothing to migrate.`);
    log('This is expected for fresh installations.');
    return;
  }

  log('Starting migration from single-user to multi-user architecture...');

  // 1. Backup original DB
  const backupDir = resolve(DATA_DIR, 'backups');
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(backupDir, `assistant-pre-multiuser-${timestamp}.db`);
  copyFileSync(ASSISTANT_DB_PATH, backupPath);
  log(`Backed up ${ASSISTANT_DB_PATH} → ${backupPath}`);

  // 2. Create admin.db with schema
  mkdirSync(dirname(ADMIN_DB_PATH), { recursive: true });
  const adminSqlite = new Database(ADMIN_DB_PATH);
  adminSqlite.pragma('journal_mode = WAL');
  adminSqlite.pragma('foreign_keys = ON');
  adminSqlite.pragma('busy_timeout = 5000');

  // Create admin tables
  adminSqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS user_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_modules_unique ON user_modules(user_id, module_id);
  `);

  // Record drizzle migration as applied so db:migrate:admin won't re-run it
  adminSqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at INTEGER
    );
  `);
  // Read the admin migration journal to get the tag/hash
  const journalPath = resolve('./server/database/admin-migrations/meta/_journal.json');
  if (existsSync(journalPath)) {
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
    const insertMigration = adminSqlite.prepare(
      'INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
    );
    for (const entry of journal.entries) {
      insertMigration.run(entry.tag, entry.when);
    }
  }
  log('Created admin.db schema');

  // 3. Copy users from assistant.db to admin.db
  const srcSqlite = new Database(ASSISTANT_DB_PATH);

  // Check if users table exists in source
  const hasUsersTable = srcSqlite.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`,
  ).get();

  if (!hasUsersTable) {
    log('No users table found in source DB. Skipping user migration.');
    srcSqlite.close();
    adminSqlite.close();
    writeFileSync(STATE_FILE, `completed: ${new Date().toISOString()}\nno-users-found`);
    return;
  }

  const srcUsers = srcSqlite.prepare('SELECT * FROM users').all() as Array<{
    id: number;
    username: string;
    password_hash: string;
    created_at: number;
  }>;

  if (srcUsers.length === 0) {
    log('No users found in source DB.');
    srcSqlite.close();
    adminSqlite.close();
    writeFileSync(STATE_FILE, `completed: ${new Date().toISOString()}\nempty-users`);
    return;
  }

  const now = Date.now();
  const insertUser = adminSqlite.prepare(
    `INSERT OR IGNORE INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)`,
  );
  const insertModule = adminSqlite.prepare(
    `INSERT OR IGNORE INTO user_modules (user_id, module_id, enabled, updated_at) VALUES (?, ?, 1, ?)`,
  );

  const migrateUsers = adminSqlite.transaction(() => {
    for (const u of srcUsers) {
      // All existing users become admin with all modules enabled
      insertUser.run(u.username, u.password_hash, 'admin', u.created_at);

      // Get the inserted user's ID
      const row = adminSqlite.prepare('SELECT id FROM users WHERE username = ?').get(u.username) as { id: number };
      if (!row) continue;

      // Enable all modules for this user
      for (const moduleId of ALL_MODULE_IDS) {
        insertModule.run(row.id, moduleId, now);
      }

      log(`Migrated user "${u.username}" as admin with all modules enabled`);
    }
  });
  migrateUsers();

  // 4. Create per-user DBs
  const usersDir = resolve(DATA_DIR, 'users');
  mkdirSync(usersDir, { recursive: true });

  for (const u of srcUsers) {
    const userDbPath = resolve(usersDir, `${u.username}.db`);

    if (existsSync(userDbPath)) {
      log(`User DB already exists: ${userDbPath}. Skipping.`);
      continue;
    }

    // Copy assistant.db as user's DB
    copyFileSync(ASSISTANT_DB_PATH, userDbPath);
    log(`Copied assistant.db → ${userDbPath}`);

    // Remove users table from user DB (security: no password hashes in user DBs)
    const userSqlite = new Database(userDbPath);
    userSqlite.pragma('journal_mode = WAL');

    try {
      userSqlite.exec('DROP TABLE IF EXISTS users');
      log(`Dropped users table from ${u.username}.db`);
    } catch (err) {
      log(`Warning: could not drop users table from ${u.username}.db: ${err}`);
    }

    // Clean up vocabUsers if exists
    try {
      userSqlite.exec('DROP TABLE IF EXISTS vocab_users');
      log(`Dropped vocab_users table from ${u.username}.db`);
    } catch {
      // Table might not exist, that's fine
    }

    userSqlite.close();
  }

  // 5. Cleanup
  srcSqlite.close();
  adminSqlite.close();

  // 6. Write completion state
  const usernames = srcUsers.map((u) => u.username).join(', ');
  writeFileSync(
    STATE_FILE,
    `completed: ${new Date().toISOString()}\nusers: ${usernames}\nmodules: ${ALL_MODULE_IDS.join(', ')}`,
  );

  log('Migration completed successfully!');
  log(`  Admin DB: ${ADMIN_DB_PATH}`);
  log(`  User DBs: ${usersDir}/`);
  log(`  Backup: ${backupPath}`);
  log(`  Users migrated: ${usernames}`);
}

main();
