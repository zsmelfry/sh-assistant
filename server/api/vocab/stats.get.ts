import { eq, sql, count } from 'drizzle-orm';
import { vocabWords, vocabProgress, LEARNING_STATUS } from '../../database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = query.userId ? Number(query.userId) : null;

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' });
  }

  const db = useDB();

  // 总词数
  const totalResult = await db.select({ count: count() }).from(vocabWords);
  const total = totalResult[0]?.count || 0;

  // 各状态统计
  const statusCounts = await db.all(sql`
    SELECT
      COALESCE(p.learning_status, ${LEARNING_STATUS.UNREAD}) as status,
      COUNT(*) as count
    FROM vocab_words w
    LEFT JOIN vocab_progress p ON w.id = p.word_id AND p.user_id = ${userId}
    GROUP BY COALESCE(p.learning_status, ${LEARNING_STATUS.UNREAD})
  `);

  const stats: Record<string, number> = {
    unread: 0,
    to_learn: 0,
    learning: 0,
    mastered: 0,
  };

  for (const row of statusCounts as any[]) {
    if (row.status in stats) {
      stats[row.status] = row.count;
    }
  }

  return {
    total,
    unread: stats.unread,
    toLearn: stats.to_learn,
    learning: stats.learning,
    mastered: stats.mastered,
  };
});
