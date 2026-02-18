import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function useDB() {
  if (!_db) {
    const dbPath = process.env.DATABASE_PATH || './data/assistant.db';

    // 确保数据库目录存在
    mkdirSync(dirname(dbPath), { recursive: true });

    const sqlite = new Database(dbPath);

    // 启用 WAL 模式，提升并发读性能
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    _db = drizzle(sqlite, { schema });
  }
  return _db;
}
