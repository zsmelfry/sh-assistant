import { eq, and, lte, sql, gte } from 'drizzle-orm';
import { srsCards, reviewLogs, studySessions } from '../../../database/schemas/srs';
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

  // 1. SRS 卡片总览
  const allCards = await db.select().from(srsCards).where(eq(srsCards.userId, userId));
  const totalCards = allCards.length;
  const dueCards = allCards.filter(c => c.nextReviewAt <= now && c.repetitions > 0).length;
  const newCards = allCards.filter(c => c.repetitions === 0).length;
  const learningCards = allCards.filter(c => c.repetitions > 0 && c.interval < 21).length;
  const matureCards = allCards.filter(c => c.interval >= 21).length;

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
