import { sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptCategories } from '~/server/database/schema';
import { requireNonEmpty } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const name = requireNonEmpty(body.name, '分类名称');
  const db = useDB();

  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${ptCategories.sortOrder}), -1)` })
    .from(ptCategories);

  const now = Date.now();
  const [inserted] = await db.insert(ptCategories).values({
    name,
    sortOrder: maxRow.max + 1,
    createdAt: now,
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
