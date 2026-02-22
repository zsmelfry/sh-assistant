import { eq } from 'drizzle-orm';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { useDB } from '~/server/database';

/**
 * Parse a numeric route parameter and throw 400 if invalid.
 */
export function requireNumericParam(event: any, name: string, label: string): number {
  const raw = getRouterParam(event, name);
  const id = Number(raw);
  if (!raw || isNaN(id)) {
    throw createError({ statusCode: 400, message: `无效的${label} ID` });
  }
  return id;
}

/**
 * Validate that a value is a non-empty string. Returns trimmed string or throws 400.
 */
export function requireNonEmpty(value: unknown, fieldName: string): string {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw createError({ statusCode: 400, message: `${fieldName}不能为空` });
  }
  return value.trim();
}

/**
 * Fetch a single row by ID and throw 404 if not found.
 */
export async function requireEntity<T extends Record<string, any>>(
  db: BetterSQLite3Database<any>,
  table: SQLiteTableWithColumns<any>,
  id: number | string,
  label: string,
): Promise<T> {
  const rows = await db.select()
    .from(table)
    .where(eq(table.id, id))
    .limit(1);

  if (rows.length === 0) {
    throw createError({ statusCode: 404, message: `${label}不存在` });
  }
  return rows[0] as T;
}

/**
 * Parse pagination params from query string. Returns { page, limit, offset }.
 */
export function parsePagination(query: Record<string, any>, opts?: {
  defaultLimit?: number;
  maxLimit?: number;
  pageSizeKey?: string;
}): { page: number; limit: number; offset: number } {
  const maxLimit = opts?.maxLimit ?? 100;
  const defaultLimit = opts?.defaultLimit ?? 20;
  const limitKey = opts?.pageSizeKey ?? 'limit';

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query[limitKey]) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
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
    await requireEntity(db, table, id, label);
    await db.delete(table).where(eq(table.id, id));
    return { success: true };
  });
}
