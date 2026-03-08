import { useDB } from '~/server/database';
import { eq, and } from 'drizzle-orm';
import { srsCards, reviewLogs, studySessions } from '../../../database/schemas/srs';
import { vocabProgress, vocabWords, LEARNING_STATUS } from '../../../database/schemas/vocab';
import { vocabStatusHistory } from '../../../database/schemas/vocab';
import { calculateNextReview, AUTO_MASTERY_INTERVAL_DAYS } from '../../../utils/srs-algorithm';
import type { StudyQuality } from '../../../utils/srs-algorithm';
import { formatDate } from '../../../utils/date';
import { logActivity } from '~/server/lib/ability/log-activity';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { userId, wordId, cardId, quality, isNew } = body;

  // 输入校验
  if (!userId || !Number.isInteger(Number(userId))) {
    throw createError({ statusCode: 400, message: 'userId 是必填参数（整数）' });
  }
  if (!wordId || !Number.isInteger(Number(wordId))) {
    throw createError({ statusCode: 400, message: 'wordId 是必填参数（整数）' });
  }
  if (quality === undefined || quality === null || !Number.isInteger(Number(quality)) || Number(quality) < 0 || Number(quality) > 5) {
    throw createError({ statusCode: 400, message: 'quality 必须是 0-5 的整数' });
  }

  const db = useDB();
  const uid = Number(userId);
  const wid = Number(wordId);
  const q = Number(quality) as StudyQuality;
  const now = Date.now();
  const today = formatDate(new Date());

  // 验证单词存在
  const wordResult = await db.select().from(vocabWords).where(eq(vocabWords.id, wid)).limit(1);
  if (wordResult.length === 0) {
    throw createError({ statusCode: 404, message: '单词不存在' });
  }

  let card;

  if (cardId) {
    // 评价已有卡片
    const cardResult = await db.select().from(srsCards).where(eq(srsCards.id, Number(cardId))).limit(1);
    if (cardResult.length === 0) {
      throw createError({ statusCode: 404, message: 'SRS 卡片不存在' });
    }
    card = cardResult[0];
  } else {
    // 查找或创建卡片（新词）
    const existing = await db.select()
      .from(srsCards)
      .where(and(eq(srsCards.userId, uid), eq(srsCards.wordId, wid)))
      .limit(1);

    if (existing.length > 0) {
      card = existing[0];
    } else {
      // 创建新卡片
      const result = await db.insert(srsCards).values({
        userId: uid,
        wordId: wid,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewAt: now,
        lastReviewedAt: null,
      }).returning();
      card = result[0];
    }
  }

  // 计算下次复习
  const previousInterval = card.interval;
  const previousEaseFactor = card.easeFactor;
  const reviewResult = calculateNextReview(card, q);

  // 更新卡片
  await db.update(srsCards)
    .set({
      easeFactor: reviewResult.easeFactor,
      interval: reviewResult.interval,
      repetitions: reviewResult.repetitions,
      nextReviewAt: reviewResult.nextReviewAt,
      lastReviewedAt: reviewResult.lastReviewedAt,
    })
    .where(eq(srsCards.id, card.id));

  // 记录复习日志
  await db.insert(reviewLogs).values({
    userId: uid,
    wordId: wid,
    srsCardId: card.id,
    quality: q,
    previousInterval,
    newInterval: reviewResult.interval,
    previousEaseFactor,
    newEaseFactor: reviewResult.easeFactor,
    reviewedAt: now,
  });

  // 更新/创建今日会话
  const sessionResult = await db.select()
    .from(studySessions)
    .where(and(eq(studySessions.userId, uid), eq(studySessions.date, today)))
    .limit(1);

  if (sessionResult.length > 0) {
    const session = sessionResult[0];
    const updates: Record<string, unknown> = {
      reviewsCompleted: session.reviewsCompleted + 1,
    };
    if (isNew) {
      updates.newWordsStudied = session.newWordsStudied + 1;
    }
    await db.update(studySessions)
      .set(updates)
      .where(eq(studySessions.id, session.id));
  } else {
    await db.insert(studySessions).values({
      userId: uid,
      date: today,
      newWordsStudied: isNew ? 1 : 0,
      reviewsCompleted: 1,
      startedAt: now,
    });
  }

  // 间隔 >= 30 天自动标记 MASTERED
  if (reviewResult.interval >= AUTO_MASTERY_INTERVAL_DAYS) {
    const progress = await db.select()
      .from(vocabProgress)
      .where(and(eq(vocabProgress.userId, uid), eq(vocabProgress.wordId, wid)))
      .limit(1);

    if (progress.length > 0 && progress[0].learningStatus !== LEARNING_STATUS.MASTERED) {
      const prevStatus = progress[0].learningStatus;
      await db.update(vocabProgress)
        .set({
          learningStatus: LEARNING_STATUS.MASTERED,
          isMastered: true,
          masteredAt: now,
        })
        .where(eq(vocabProgress.id, progress[0].id));

      // 记录状态变更历史
      await db.insert(vocabStatusHistory).values({
        userId: uid,
        wordId: wid,
        previousStatus: prevStatus,
        newStatus: LEARNING_STATUS.MASTERED,
        changedAt: now,
      });
    }
  }

  // Log activity for ability system (daily dedup via logActivity)
  logActivity({
    source: 'vocab',
    description: '法语词汇复习',
  }).catch(() => {});

  return {
    card: {
      id: card.id,
      wordId: card.wordId,
      easeFactor: reviewResult.easeFactor,
      interval: reviewResult.interval,
      repetitions: reviewResult.repetitions,
      nextReviewAt: reviewResult.nextReviewAt,
      lastReviewedAt: reviewResult.lastReviewedAt,
    },
    autoMastered: reviewResult.interval >= AUTO_MASTERY_INTERVAL_DAYS,
  };
});
