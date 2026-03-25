import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { LRUCache } from 'lru-cache';
import * as schema from './schema';
import * as adminSchema from './admin-schema';
import { getDataDir } from '~/server/utils/data-dir';

// ── Types ──

type UserDB = ReturnType<typeof drizzle<typeof schema>>;
type AdminDB = ReturnType<typeof drizzle<typeof adminSchema>>;

// ── Helper: create SQLite connection with standard pragmas ──

function createSqliteDb(dbPath: string) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  return sqlite;
}

// ── Admin DB — 全局单例，仅认证 + 权限 ──

let _adminDb: AdminDB | null = null;

export function useAdminDB(): AdminDB {
  if (!_adminDb) {
    const dbPath = process.env.ADMIN_DB_PATH || resolve(getDataDir(), 'admin.db');
    const sqlite = createSqliteDb(dbPath);

    // Auto-migrate: ensure all admin tables exist
    const migrationsFolder = resolve('./src/server/database/admin-migrations');
    if (existsSync(migrationsFolder)) {
      migrate(drizzle(sqlite), { migrationsFolder });
    }

    _adminDb = drizzle(sqlite, { schema: adminSchema });
  }
  return _adminDb;
}

// ── User DB — LRU 缓存，按 username 路由 ──

const userDbCache = new LRUCache<string, UserDB>({
  max: 20,
  ttl: 5 * 60 * 1000, // 空闲 5 分钟自动回收
  dispose: (db) => {
    try {
      (db as any).$client?.close();
    } catch { /* already closed */ }
  },
});

export function useUserDB(username: string): UserDB {
  // 校验用户名安全性（防路径穿越）
  if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
    throw new Error('Invalid username');
  }

  const cached = userDbCache.get(username);
  if (cached) return cached;

  const dbPath = resolve(getDataDir(), 'users', `${username}.db`);
  // 二次校验：确保路径在 data/users/ 内
  const usersDir = resolve(getDataDir(), 'users');
  if (!dbPath.startsWith(usersDir + '/')) {
    throw new Error('Invalid DB path');
  }

  const sqlite = createSqliteDb(dbPath);

  // Auto-migrate: ensure all tables exist on first connect
  const migrationsFolder = resolve('./src/server/database/migrations');
  if (existsSync(migrationsFolder)) {
    migrate(drizzle(sqlite), { migrationsFolder });
  }

  const db = drizzle(sqlite, { schema });
  userDbCache.set(username, db);
  return db;
}

// ── 主入口：从 event.context 自动取 username ──

// Legacy singleton for backward compatibility during Phase 2 migration.
// Once all handlers pass event, this can be removed.
let _legacyDb: UserDB | null = null;

export function useDB(event?: any): UserDB {
  // If event has auth context, route to user DB
  if (event?.context?.auth?.username) {
    return useUserDB(event.context.auth.username);
  }

  // Fallback: legacy singleton (for handlers not yet passing event)
  if (!_legacyDb) {
    const dbPath = process.env.DATABASE_PATH || resolve(getDataDir(), 'assistant.db');
    const sqlite = createSqliteDb(dbPath);
    _legacyDb = drizzle(sqlite, { schema });
  }
  return _legacyDb;
}

/** Clear user DB cache (close all connections). Used by _test/reset. */
export function clearUserDbCache() {
  userDbCache.clear(); // triggers dispose callbacks
}

// ── 进程退出时清理所有连接 ──

function cleanupConnections() {
  userDbCache.clear(); // triggers dispose callbacks
  for (const db of [_adminDb, _legacyDb]) {
    if (db) {
      try {
        // @ts-expect-error - access underlying session to close
        db._.session.client.close();
      } catch { /* already closed */ }
    }
  }
}

process.on('exit', cleanupConnections);
