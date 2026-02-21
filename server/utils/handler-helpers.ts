import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { useDB } from '~/server/database';

/**
 * Parse a numeric route parameter and throw 400 if invalid.
 */
export function requireNumericParam(event: H3Event, name: string, label: string): number {
  const raw = getRouterParam(event, name);
  const id = Number(raw);
  if (!raw || isNaN(id)) {
    throw createError({ statusCode: 400, message: `无效的${label} ID` });
  }
  return id;
}

/**
 * Common pattern: parse ID param, check existence, delete row, return { success: true }.
 * Suitable for simple delete handlers where the only logic is validate + delete.
 */
export function createDeleteHandler(
  table: SQLiteTableWithColumns<any>,
  label: string,
  paramName = 'id',
) {
  return defineEventHandler(async (event) => {
    const id = requireNumericParam(event, paramName, label);
    const db = useDB();

    const existing = await db.select({ id: table.id })
      .from(table)
      .where(eq(table.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw createError({ statusCode: 404, message: `${label}不存在` });
    }

    await db.delete(table).where(eq(table.id, id));
    return { success: true };
  });
}
