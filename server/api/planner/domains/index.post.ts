import { sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerDomains } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '领域名称不能为空' });
  }

  const db = useDB();

  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${plannerDomains.sortOrder}), -1)` })
    .from(plannerDomains);

  const now = Date.now();
  const [inserted] = await db.insert(plannerDomains).values({
    name: body.name.trim(),
    sortOrder: maxRow.max + 1,
    createdAt: now,
    updatedAt: now,
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
