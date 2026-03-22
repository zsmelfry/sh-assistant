import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerDomains } from '~/server/database/schema';
import { requireNonEmpty } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const name = requireNonEmpty(body.name, '领域名称');

  const year = Number(body.year) || new Date().getFullYear();
  const db = useDB(event);

  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${plannerDomains.sortOrder}), -1)` })
    .from(plannerDomains)
    .where(eq(plannerDomains.year, year));

  const now = Date.now();
  const [inserted] = await db.insert(plannerDomains).values({
    name,
    year,
    sortOrder: maxRow.max + 1,
    createdAt: now,
    updatedAt: now,
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
