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
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { users } from '../server/database/schemas/auth';

const SALT_ROUNDS = 10;

function getDB() {
  const dbPath = process.env.DATABASE_PATH || './data/assistant.db';
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema: { users } });
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
  // Accept args from CLI or prompt interactively
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

  if (password.length < 4) {
    console.error('Error: password must be at least 4 characters.');
    process.exit(1);
  }

  const db = getDB();

  // Check if user already exists
  const existing = await db.select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing.length > 0) {
    console.error(`Error: user "${username}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = Date.now();

  await db.insert(users).values({
    username,
    passwordHash,
    createdAt: now,
  });

  console.log(`User "${username}" created successfully.`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
