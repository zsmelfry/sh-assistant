import { eq, sql } from 'drizzle-orm';
import { vocabStatusHistory, vocabProgress, vocabUsers, LEARNING_STATUS } from '../../../database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = query.userId ? Number(query.userId) : null;
  const days = Math.min(365, Math.max(7, Number(query.days) || 30));

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' });
  }

  const db = useDB();

  // 验证用户
  const user = await db.select().from(vocabUsers).where(eq(vocabUsers.id, userId)).limit(1);
  if (user.length === 0) throw createError({ statusCode: 404, message: 'User not found' });

  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  // 获取时间范围内的状态变更历史，按天聚合
  const history = await db.all(sql`
    SELECT
      date(changed_at / 1000, 'unixepoch') as date,
      new_status,
      COUNT(*) as count
    FROM vocab_status_history
    WHERE user_id = ${userId} AND changed_at >= ${startTime}
    GROUP BY date(changed_at / 1000, 'unixepoch'), new_status
    ORDER BY date ASC
  `);

  // 获取当前掌握进度的累计曲线
  // 以 masteredAt 时间为基准，按天累计
  const masteredCurve = await db.all(sql`
    SELECT
      date(mastered_at / 1000, 'unixepoch') as date,
      COUNT(*) as count
    FROM vocab_progress
    WHERE user_id = ${userId} AND mastered_at IS NOT NULL AND mastered_at >= ${startTime}
    GROUP BY date(mastered_at / 1000, 'unixepoch')
    ORDER BY date ASC
  `);

  // 获取首次互动的累计曲线
  const interactedCurve = await db.all(sql`
    SELECT
      date(first_interacted_at / 1000, 'unixepoch') as date,
      COUNT(*) as count
    FROM vocab_progress
    WHERE user_id = ${userId} AND first_interacted_at IS NOT NULL AND first_interacted_at >= ${startTime}
    GROUP BY date(first_interacted_at / 1000, 'unixepoch')
    ORDER BY date ASC
  `);

  return {
    dailyActivity: history,
    masteredCurve,
    interactedCurve,
    days,
  };
});
