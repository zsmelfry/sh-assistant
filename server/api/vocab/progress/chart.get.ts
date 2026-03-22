import { useDB } from '~/server/database';
import { sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const days = Math.min(365, Math.max(7, Number(query.days) || 30));

  const db = useDB(event);

  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  // 获取时间范围内的状态变更历史，按天聚合（使用 localtime 转为服务器本地时区）
  const history = await db.all(sql`
    SELECT
      date(changed_at / 1000, 'unixepoch', 'localtime') as date,
      new_status,
      COUNT(*) as count
    FROM vocab_status_history
    WHERE changed_at >= ${startTime}
    GROUP BY date(changed_at / 1000, 'unixepoch', 'localtime'), new_status
    ORDER BY date ASC
  `);

  // 获取当前掌握进度的累计曲线
  // 以 masteredAt 时间为基准，按天累计
  const masteredCurve = await db.all(sql`
    SELECT
      date(mastered_at / 1000, 'unixepoch', 'localtime') as date,
      COUNT(*) as count
    FROM vocab_progress
    WHERE mastered_at IS NOT NULL AND mastered_at >= ${startTime}
    GROUP BY date(mastered_at / 1000, 'unixepoch', 'localtime')
    ORDER BY date ASC
  `);

  // 获取首次互动的累计曲线
  const interactedCurve = await db.all(sql`
    SELECT
      date(first_interacted_at / 1000, 'unixepoch', 'localtime') as date,
      COUNT(*) as count
    FROM vocab_progress
    WHERE first_interacted_at IS NOT NULL AND first_interacted_at >= ${startTime}
    GROUP BY date(first_interacted_at / 1000, 'unixepoch', 'localtime')
    ORDER BY date ASC
  `);

  return {
    dailyActivity: history,
    masteredCurve,
    interactedCurve,
    days,
  };
});
