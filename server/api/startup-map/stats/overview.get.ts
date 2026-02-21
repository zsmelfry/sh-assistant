import { sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smDomains, smTopics, smPoints } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();

  const [row] = await db
    .select({
      totalPoints: sql<number>`count(distinct ${smPoints.id})`,
      completedCount: sql<number>`count(distinct case when ${smPoints.status} in ('understood', 'practiced') then ${smPoints.id} end)`,
    })
    .from(smDomains)
    .leftJoin(smTopics, sql`${smTopics.domainId} = ${smDomains.id}`)
    .leftJoin(smPoints, sql`${smPoints.topicId} = ${smTopics.id}`);

  const totalPoints = row?.totalPoints ?? 0;
  const completedCount = row?.completedCount ?? 0;

  return {
    totalPoints,
    completedCount,
    completionRate: totalPoints > 0 ? Math.round((completedCount / totalPoints) * 100) : 0,
  };
});
