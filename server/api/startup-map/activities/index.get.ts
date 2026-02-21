import { desc, eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smActivities, smPoints } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
  const date = typeof query.date === 'string' ? query.date : undefined;

  const db = useDB();

  // Build where conditions
  const conditions = date ? eq(smActivities.date, date) : undefined;

  // Count total
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(smActivities)
    .where(conditions);

  const total = countRow?.count ?? 0;

  // Fetch page with point name
  const rows = await db
    .select({
      id: smActivities.id,
      pointId: smActivities.pointId,
      type: smActivities.type,
      date: smActivities.date,
      createdAt: smActivities.createdAt,
      pointName: smPoints.name,
    })
    .from(smActivities)
    .leftJoin(smPoints, sql`${smPoints.id} = ${smActivities.pointId}`)
    .where(conditions)
    .orderBy(desc(smActivities.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
});
