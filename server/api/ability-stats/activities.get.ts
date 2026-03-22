import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { activityLogs, skills } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const db = useDB(event);

  const skillId = query.skillId ? Number(query.skillId) : null;
  const from = query.from as string | undefined;
  const to = query.to as string | undefined;
  const limit = Math.min(Number(query.limit) || 50, 200);
  const offset = Number(query.offset) || 0;

  const conditions = [];
  if (skillId) conditions.push(eq(activityLogs.skillId, skillId));
  if (from) conditions.push(gte(activityLogs.date, from));
  if (to) conditions.push(lte(activityLogs.date, to));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select({
    id: activityLogs.id,
    skillId: activityLogs.skillId,
    skillName: skills.name,
    categoryId: activityLogs.categoryId,
    source: activityLogs.source,
    sourceRef: activityLogs.sourceRef,
    description: activityLogs.description,
    date: activityLogs.date,
    createdAt: activityLogs.createdAt,
  })
    .from(activityLogs)
    .leftJoin(skills, eq(skills.id, activityLogs.skillId))
    .where(where)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [total] = await db.select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(where);

  return { activities: rows, total: total.count };
});
