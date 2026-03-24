import { useDB } from '~/server/database';
import { eq, sql, gte } from 'drizzle-orm';
import { studySessions } from '../../../database/schemas/srs';
import { LEARNING_STATUS } from '../../../database/schemas/vocab';
import { formatDate } from '../../../utils/date';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const now = Date.now();
  const today = formatDate(new Date());

  // Scope to active wordbook
  const activeWordbook = getActiveWordbook(db);

  // 1. SRS 卡片总览 — 分类逻辑与 cards.get.ts 保持一致（限定活跃词汇本）
  const stageRows = await db.all(sql`
    SELECT stage, COUNT(*) as cnt FROM (
      SELECT CASE
        WHEN s.interval >= 21 THEN 'mastered'
        WHEN s.next_review_at <= ${now} AND s.repetitions > 0 THEN 'due'
        WHEN s.interval <= 6 THEN 'beginner'
        ELSE 'consolidating'
      END as stage
      FROM srs_cards s
      INNER JOIN vocab_words w ON s.word_id = w.id
      WHERE w.wordbook_id = ${activeWordbook.id}
    ) GROUP BY stage
  `) as Array<{ stage: string; cnt: number }>;
  const stageCounts: Record<string, number> = { due: 0, beginner: 0, consolidating: 0, mastered: 0 };
  let totalCards = 0;
  for (const row of stageRows) {
    stageCounts[row.stage] = row.cnt;
    totalCards += row.cnt;
  }

  // 2. 今日会话统计
  const sessionResult = await db.select()
    .from(studySessions)
    .where(eq(studySessions.date, today))
    .limit(1);
  const todaySession = sessionResult[0] || null;

  // 3. 最近 7 天复习日志（限定活跃词汇本）
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recentLogs = await db.all(sql`
    SELECT r.*
    FROM review_logs r
    INNER JOIN vocab_words w ON r.word_id = w.id
    WHERE r.reviewed_at >= ${sevenDaysAgo}
      AND w.wordbook_id = ${activeWordbook.id}
  `) as Array<{ reviewedAt: number; quality: number }>;

  // 按天分组统计
  const dailyStats: Record<string, { reviews: number; avgQuality: number }> = {};
  for (const log of recentLogs) {
    const date = formatDate(new Date(log.reviewedAt));
    if (!dailyStats[date]) {
      dailyStats[date] = { reviews: 0, avgQuality: 0 };
    }
    dailyStats[date].reviews += 1;
    dailyStats[date].avgQuality += log.quality;
  }
  for (const date of Object.keys(dailyStats)) {
    const stat = dailyStats[date];
    stat.avgQuality = stat.reviews > 0 ? Math.round((stat.avgQuality / stat.reviews) * 10) / 10 : 0;
  }

  // 4. 最近 7 天会话
  // TODO: studySessions cannot be scoped by wordbook without a schema change
  // (study_sessions table has no wordbook_id column). Known limitation.
  const recentSessions = await db.select()
    .from(studySessions)
    .where(gte(studySessions.startedAt, sevenDaysAgo));

  // 5. 可学新词总数（LEARNING 状态但还没有 SRS 卡片的词，限定活跃词汇本）
  const availableCountResult = await db.all(sql`
    SELECT COUNT(*) as count
    FROM vocab_progress p
    INNER JOIN vocab_words w ON p.word_id = w.id
    LEFT JOIN srs_cards s ON p.word_id = s.word_id
    WHERE p.learning_status = ${LEARNING_STATUS.LEARNING}
      AND s.id IS NULL
      AND w.wordbook_id = ${activeWordbook.id}
  `) as Array<{ count: number }>;
  const availableLearningCount = availableCountResult[0]?.count || 0;

  // 6. 各学习状态统计（限定活跃词汇本）
  const statusCounts = await db.all(sql`
    SELECT p.learning_status as status, COUNT(*) as count
    FROM vocab_progress p
    INNER JOIN vocab_words w ON p.word_id = w.id
    WHERE w.wordbook_id = ${activeWordbook.id}
    GROUP BY p.learning_status
  `) as Array<{ status: string; count: number }>;

  const statusStats: Record<string, number> = {
    unread: 0,
    to_learn: 0,
    learning: 0,
    mastered: 0,
  };
  for (const row of statusCounts) {
    if (row.status in statusStats) {
      statusStats[row.status] = row.count;
    }
  }

  return {
    cards: {
      total: totalCards,
      due: stageCounts.due,
      beginner: stageCounts.beginner,
      consolidating: stageCounts.consolidating,
      mastered: stageCounts.mastered,
    },
    todaySession: todaySession ? {
      newWordsStudied: todaySession.newWordsStudied,
      reviewsCompleted: todaySession.reviewsCompleted,
      startedAt: todaySession.startedAt,
      completedAt: todaySession.completedAt,
    } : null,
    recentDays: dailyStats,
    recentSessions: recentSessions.map(s => ({
      date: s.date,
      newWordsStudied: s.newWordsStudied,
      reviewsCompleted: s.reviewsCompleted,
    })),
    vocabStatus: statusStats,
    availableLearningCount,
  };
});
