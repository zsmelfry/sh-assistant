/**
 * 共享的 Progress 初始化逻辑
 * 为指定用户初始化所有词汇的 progress 记录（默认 UNREAD）
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { vocabWords, vocabProgress } from '../database/schemas/vocab';

const BATCH_SIZE = 500;

/**
 * 异步版本：为单个用户初始化所有词汇的 progress
 * 用于非事务上下文（如 users.post.ts）
 */
export async function initProgressForUser(db: BetterSQLite3Database, userId: number): Promise<void> {
  const allWords = await db.select({ id: vocabWords.id }).from(vocabWords);
  if (allWords.length === 0) return;

  for (let i = 0; i < allWords.length; i += BATCH_SIZE) {
    const batch = allWords.slice(i, i + BATCH_SIZE).map((w) => ({
      userId,
      wordId: w.id,
      learningStatus: 'unread' as const,
      isRead: false,
      isMastered: false,
    }));
    await db.insert(vocabProgress).values(batch);
  }
}

/**
 * 同步版本：在 better-sqlite3 事务内为多个用户初始化 progress
 * 用于事务上下文（如 words-import.post.ts）
 */
export function initProgressForUsersSync(tx: BetterSQLite3Database, userIds: number[]): void {
  if (userIds.length === 0) return;

  const allWords = tx.select({ id: vocabWords.id }).from(vocabWords).all();
  if (allWords.length === 0) return;

  for (const userId of userIds) {
    for (let i = 0; i < allWords.length; i += BATCH_SIZE) {
      const batch = allWords.slice(i, i + BATCH_SIZE).map((w) => ({
        userId,
        wordId: w.id,
        learningStatus: 'unread' as const,
        isRead: false,
        isMastered: false,
      }));
      tx.insert(vocabProgress).values(batch).run();
    }
  }
}
