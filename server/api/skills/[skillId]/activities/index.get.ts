import { and, desc, eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smActivities, smPoints } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';
import { parsePagination } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { skillId } = await resolveSkill(db, event);
  const query = getQuery(event);
  const { page, limit: pageSize, offset } = parsePagination(query, { maxLimit: 50, pageSizeKey: 'pageSize' });
  const date = typeof query.date === 'string' ? query.date : undefined;

  const conditions = [eq(smActivities.skillId, skillId)];
  if (date) conditions.push(eq(smActivities.date, date));

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(smActivities)
    .where(and(...conditions));

  const total = countRow?.count ?? 0;

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
    .where(and(...conditions))
    .orderBy(desc(smActivities.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
});
