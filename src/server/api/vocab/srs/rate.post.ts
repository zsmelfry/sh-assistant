import { useDB } from '~/server/database';
import { eq, and } from 'drizzle-orm';
import { srsCards, reviewLogs, studySessions } from '../../../database/schemas/srs';
import { vocabProgress, vocabWords, LEARNING_STATUS } from '../../../database/schemas/vocab';
import { vocabStatusHistory } from '../../../database/schemas/vocab';
import { calculateNextReview, AUTO_MASTERY_INTERVAL_DAYS } from '../../../utils/srs-algorithm';
import type { StudyQuality } from '../../../utils/srs-algorithm';
import { formatDate } from '../../../utils/date';
import { logActivity } from '~/server/lib/ability/log-activity';
import { ensureVocabUser } from '../../../utils/ensure-vocab-user';
import { getLanguageConfig } from '~/server/lib/vocab/languages';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { wordId, cardId, quality, isNew } = body;

  // 输入校验
  if (!wordId || !Number.isInteger(Number(wordId))) {
    throw createError({ statusCode: 400, message: 'wordId 是必填参数（整数）' });
  }
  if (quality === undefined || quality === null || !Number.isInteger(Number(quality)) || Number(quality) < 0 || Number(quality) > 5) {
    throw createError({ statusCode: 400, message: 'quality 必须是 0-5 的整数' });
  }

  const db = useDB(event);
  const username = event.context.auth?.username;
  if (!username) throw createError({ statusCode: 401, message: 'Unauthorized' });
  const vocabUserId = ensureVocabUser(db, username);
  const wid = Number(wordId);
  const q = Number(quality) as StudyQuality;
  const now = Date.now();
  const today = formatDate(new Date());

  // Scope to active wordbook
  const activeWordbook = getActiveWordbook(db);

  // 验证单词存在且属于活跃词汇本
  const wordResult = await db.select().from(vocabWords).where(eq(vocabWords.id, wid)).limit(1);
  if (wordResult.length === 0) {
    throw createError({ statusCode: 404, message: '单词不存在' });
  }
  if (wordResult[0].wordbookId !== activeWordbook.id) {
    throw createError({ statusCode: 400, message: '该单词不属于当前活跃词汇本' });
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
      .where(eq(srsCards.wordId, wid))
      .limit(1);

    if (existing.length > 0) {
      card = existing[0];
    } else {
      // 创建新卡片
      const result = await db.insert(srsCards).values({
        userId: vocabUserId,
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
    userId: vocabUserId,
    wordId: wid,
    srsCardId: card.id,
    quality: q,
    previousInterval,
    newInterval: reviewResult.interval,
    previousEaseFactor,
    newEaseFactor: reviewResult.easeFactor,
    reviewedAt: now,
  });

  // 更新/创建今日会话（按词汇本隔离）
  const sessionResult = await db.select()
    .from(studySessions)
    .where(and(eq(studySessions.date, today), eq(studySessions.wordbookId, activeWordbook.id)))
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
      userId: vocabUserId,
      date: today,
      wordbookId: activeWordbook.id,
      newWordsStudied: isNew ? 1 : 0,
      reviewsCompleted: 1,
      startedAt: now,
    });
  }

  // 间隔 >= 30 天自动标记 MASTERED
  if (reviewResult.interval >= AUTO_MASTERY_INTERVAL_DAYS) {
    const progress = await db.select()
      .from(vocabProgress)
      .where(eq(vocabProgress.wordId, wid))
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

      // 已掌握，清除下次复习时间
      await db.update(srsCards)
        .set({ nextReviewAt: 0 })
        .where(eq(srsCards.id, card.id));

      // 记录状态变更历史
      await db.insert(vocabStatusHistory).values({
        userId: vocabUserId,
        wordId: wid,
        previousStatus: prevStatus,
        newStatus: LEARNING_STATUS.MASTERED,
        changedAt: now,
      });
    }
  }

  // Log activity for ability system (daily dedup via logActivity)
  const langConfig = getLanguageConfig(activeWordbook.language);
  logActivity(db, {
    source: 'vocab',
    description: `${langConfig.displayName}词汇复习`,
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
