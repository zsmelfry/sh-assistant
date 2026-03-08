import { desc, eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { activityLogs, skills } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = Math.min(Math.max(1, Number(query.limit) || 10), 50);

  const db = useDB();

  const rows = await db.select({
    id: activityLogs.id,
    skillId: activityLogs.skillId,
    skillName: skills.name,
    source: activityLogs.source,
    sourceRef: activityLogs.sourceRef,
    description: activityLogs.description,
    date: activityLogs.date,
    createdAt: activityLogs.createdAt,
  })
    .from(activityLogs)
    .leftJoin(skills, eq(skills.id, activityLogs.skillId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  return rows;
});
