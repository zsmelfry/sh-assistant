/**
 * Seed script: create admin user for authentication
 *
 * Usage:
 *   npm run db:seed-user                        # interactive prompt
 *   npm run db:seed-user -- <username> <password>  # non-interactive
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { users, userModules } from '../../src/server/database/admin-schema';

const SALT_ROUNDS = 10;
const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;

const ALL_MODULE_IDS = [
  'dashboard', 'ability-profile', 'habit-tracker', 'annual-planner',
  'vocab-tracker', 'article-reader', 'project-tracker', 'skill-manager', 'xiaoshuang',
];

function getAdminDB() {
  const dataDir = process.env.DATA_DIR || './data';
  const dbPath = process.env.ADMIN_DB_PATH || resolve(dataDir, 'admin.db');
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  // Ensure admin tables exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      email TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS user_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_modules_unique ON user_modules(user_id, module_id);
  `);

  return drizzle(sqlite, { schema: { users, userModules } });
}

function initUserDB(username: string) {
  const dataDir = process.env.DATA_DIR || './data';
  const usersDir = resolve(dataDir, 'users');
  mkdirSync(usersDir, { recursive: true });
  const dbPath = resolve(usersDir, `${username}.db`);
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  // User DB tables will be created by drizzle-kit migrate
  sqlite.close();
  console.log(`User DB created at ${dbPath}`);
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  let username = process.argv[2];
  let password = process.argv[3];

  if (!username) {
    username = await prompt('Username: ');
  }
  if (!password) {
    password = await prompt('Password: ');
  }

  if (!username || !password) {
    console.error('Error: username and password are required.');
    process.exit(1);
  }

  if (!USERNAME_REGEX.test(username)) {
    console.error('Error: username must match /^[a-z0-9_-]{3,30}$/');
    process.exit(1);
  }

  if (password.length < 4) {
    console.error('Error: password must be at least 4 characters.');
    process.exit(1);
  }

  const db = getAdminDB();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = Date.now();

  // Check if user already exists
  const existing = await db.select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing.length > 0) {
    await db.update(users)
      .set({ passwordHash })
      .where(eq(users.username, username));
    console.log(`User "${username}" password updated.`);
  } else {
    const [user] = await db.insert(users).values({
      username,
      passwordHash,
      role: 'admin',
      createdAt: now,
    }).returning();

    // Enable all modules for admin user
    if (user) {
      await db.insert(userModules).values(
        ALL_MODULE_IDS.map((moduleId) => ({
          userId: user.id,
          moduleId,
          enabled: true,
          updatedAt: now,
        })),
      );
    }

    // Create user DB
    initUserDB(username);

    console.log(`User "${username}" created as admin with all modules enabled.`);
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
