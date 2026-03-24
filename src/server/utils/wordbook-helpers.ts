import { eq } from 'drizzle-orm';
import { wordbooks, vocabSettings } from '~/server/database/schemas/vocab';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

/**
 * Get the currently active wordbook. Throws 404 if none is active.
 */
export function getActiveWordbook(db: BetterSQLite3Database<any>) {
  const row = db.select()
    .from(wordbooks)
    .where(eq(wordbooks.isActive, true))
    .limit(1)
    .get();

  if (!row) {
    throw createError({ statusCode: 404, message: '没有活跃的词汇本' });
  }

  return row;
}

/**
 * Get a wordbook by ID. Throws 404 if not found.
 */
export function getWordbookById(db: BetterSQLite3Database<any>, id: number) {
  const row = db.select()
    .from(wordbooks)
    .where(eq(wordbooks.id, id))
    .limit(1)
    .get();

  if (!row) {
    throw createError({ statusCode: 404, message: `词汇本 ${id} 不存在` });
  }

  return row;
}

/**
 * Set a wordbook as active, deactivating all others. Uses a transaction.
 */
export function setActiveWordbook(db: BetterSQLite3Database<any>, id: number) {
  db.transaction((tx) => {
    // Deactivate all wordbooks
    tx.update(wordbooks)
      .set({ isActive: false })
      .run();

    // Activate the target wordbook
    const result = tx.update(wordbooks)
      .set({ isActive: true })
      .where(eq(wordbooks.id, id))
      .run();

    if (result.changes === 0) {
      throw createError({ statusCode: 404, message: `词汇本 ${id} 不存在` });
    }
  });
}

/**
 * Check whether the multi-wordbook feature gate is enabled.
 */
export function isMultiWordbookEnabled(db: BetterSQLite3Database<any>): boolean {
  const row = db.select({ value: vocabSettings.value })
    .from(vocabSettings)
    .where(eq(vocabSettings.key, 'multi_wordbook_enabled'))
    .limit(1)
    .get();

  return row?.value === 'true';
}
