import { eq } from 'drizzle-orm';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { useDB } from '~/server/database';

/**
 * Factory for creating reorder PUT handlers.
 * Expects body: { items: { id: number, sortOrder: number }[] }
 */
export function createReorderHandler(
  table: SQLiteTable & {
    id: SQLiteColumn;
    sortOrder: SQLiteColumn;
    updatedAt: SQLiteColumn;
  },
) {
  return defineEventHandler(async (event) => {
    const body = await readBody(event);

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw createError({ statusCode: 400, message: '缺少排序项' });
    }

    for (const item of body.items) {
      if (typeof item.id !== 'number' || typeof item.sortOrder !== 'number') {
        throw createError({ statusCode: 400, message: '排序项格式无效' });
      }
    }

    const db = useDB();
    const now = Date.now();

    db.transaction((tx) => {
      for (const item of body.items) {
        tx.update(table)
          .set({ sortOrder: item.sortOrder, updatedAt: now })
          .where(eq(table.id, item.id))
          .run();
      }
    });

    return { success: true };
  });
}
