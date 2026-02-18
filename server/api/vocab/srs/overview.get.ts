import { eq, and, sql, gte } from 'drizzle-orm';
import { reviewLogs, studySessions } from '../../../database/schemas/srs';
import { vocabProgress, LEARNING_STATUS } from '../../../database/schemas/vocab';
import { formatDate } from '../../../utils/date';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = query.userId ? Number(query.userId) : null;

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId 是必填参数' });
  }

  const db = useDB();
  const now = Date.now();
  const today = formatDate(new Date());

  // 1. SRS 卡片总览（SQL 聚合，避免全表扫描到内存）
  const cardStats = await db.all(sql`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN next_review_at <= ${now} AND repetitions > 0 THEN 1 ELSE 0 END), 0) as due,
      COALESCE(SUM(CASE WHEN repetitions = 0 THEN 1 ELSE 0 END), 0) as new_cards,
      COALESCE(SUM(CASE WHEN repetitions > 0 AND interval < 21 THEN 1 ELSE 0 END), 0) as learning,
      COALESCE(SUM(CASE WHEN interval >= 21 THEN 1 ELSE 0 END), 0) as mature
    FROM srs_cards
    WHERE user_id = ${userId}
  `) as Array<{ total: number; due: number; new_cards: number; learning: number; mature: number }>;
  const stats = cardStats[0] || { total: 0, due: 0, new_cards: 0, learning: 0, mature: 0 };
  const totalCards = stats.total;
  const dueCards = stats.due;
  const newCards = stats.new_cards;
  const learningCards = stats.learning;
  const matureCards = stats.mature;

  // 2. 今日会话统计
  const sessionResult = await db.select()
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), eq(studySessions.date, today)))
    .limit(1);
  const todaySession = sessionResult[0] || null;

  // 3. 最近 7 天复习日志
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recentLogs = await db.select()
    .from(reviewLogs)
    .where(and(
      eq(reviewLogs.userId, userId),
      gte(reviewLogs.reviewedAt, sevenDaysAgo),
    ));

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
  const recentSessions = await db.select()
    .from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      gte(studySessions.startedAt, sevenDaysAgo),
    ));

  // 5. 各学习状态统计
  const statusCounts = await db.all(sql`
    SELECT learning_status as status, COUNT(*) as count
    FROM vocab_progress
    WHERE user_id = ${userId}
    GROUP BY learning_status
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
      due: dueCards,
      new: newCards,
      learning: learningCards,
      mature: matureCards,
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
  };
});
