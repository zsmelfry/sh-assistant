import { eq, and, lte, sql } from 'drizzle-orm';
import { srsCards, studySessions } from '../../../database/schemas/srs';
import { vocabProgress, vocabWords, LEARNING_STATUS } from '../../../database/schemas/vocab';
import { NEW_WORDS_PER_SESSION, MAX_REVIEWS_PER_SESSION } from '../../../utils/srs-algorithm';
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

  // 1. 获取到期需要复习的卡片（排除 MASTERED 状态的单词）
  const allCards = await db.select({
    card: srsCards,
    word: vocabWords,
  })
    .from(srsCards)
    .innerJoin(vocabWords, eq(srsCards.wordId, vocabWords.id))
    .where(and(
      eq(srsCards.userId, userId),
      lte(srsCards.nextReviewAt, now),
    ));

  // 获取已掌握单词 ID 集合
  const masteredProgress = await db.select({ wordId: vocabProgress.wordId })
    .from(vocabProgress)
    .where(and(
      eq(vocabProgress.userId, userId),
      eq(vocabProgress.learningStatus, LEARNING_STATUS.MASTERED),
    ));
  const masteredWordIds = new Set(masteredProgress.map(p => p.wordId));

  // 过滤：已到复习时间 + 已学过（repetitions > 0）+ 未掌握
  const dueCards = allCards
    .filter(({ card }) =>
      card.repetitions > 0 && !masteredWordIds.has(card.wordId),
    )
    .sort((a, b) => a.card.nextReviewAt - b.card.nextReviewAt)
    .slice(0, MAX_REVIEWS_PER_SESSION);

  // 2. 获取今日会话信息
  const sessionResult = await db.select()
    .from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      eq(studySessions.date, today),
    ))
    .limit(1);

  const todaySession = sessionResult[0] || null;
  const newWordsStudiedToday = todaySession?.newWordsStudied || 0;
  const remainingNewWords = Math.max(0, NEW_WORDS_PER_SESSION - newWordsStudiedToday);

  // 3. 获取新词（从 LEARNING 状态中取还没有 SRS 卡片的）
  let newWords: Array<{ id: number; rank: number; word: string }> = [];
  if (remainingNewWords > 0) {
    // 已有 SRS 卡片的 wordId
    const existingCardWords = await db.select({ wordId: srsCards.wordId })
      .from(srsCards)
      .where(eq(srsCards.userId, userId));
    const existingWordIds = new Set(existingCardWords.map(c => c.wordId));

    // LEARNING 状态的 wordId
    const learningProgress = await db.select({ wordId: vocabProgress.wordId })
      .from(vocabProgress)
      .where(and(
        eq(vocabProgress.userId, userId),
        eq(vocabProgress.learningStatus, LEARNING_STATUS.LEARNING),
      ));

    const learningWordIds = learningProgress
      .filter(p => !existingWordIds.has(p.wordId))
      .map(p => p.wordId);

    if (learningWordIds.length > 0) {
      // 按 rank 排序取前 N 个
      const allWordsResult = await db.select()
        .from(vocabWords)
        .orderBy(vocabWords.rank);

      newWords = allWordsResult
        .filter(w => learningWordIds.includes(w.id))
        .slice(0, remainingNewWords);
    }
  }

  // 4. 可学新词总数（用于前端显示）
  const availableCountResult = await db.all(sql`
    SELECT COUNT(*) as count
    FROM vocab_progress p
    LEFT JOIN srs_cards s ON p.word_id = s.word_id AND s.user_id = ${userId}
    WHERE p.user_id = ${userId}
      AND p.learning_status = ${LEARNING_STATUS.LEARNING}
      AND s.id IS NULL
  `) as Array<{ count: number }>;
  const availableLearningCount = availableCountResult[0]?.count || 0;

  return {
    dueReviews: dueCards.map(({ card, word }) => ({
      cardId: card.id,
      wordId: card.wordId,
      word: word.word,
      rank: word.rank,
      easeFactor: card.easeFactor,
      interval: card.interval,
      repetitions: card.repetitions,
      nextReviewAt: card.nextReviewAt,
      lastReviewedAt: card.lastReviewedAt,
    })),
    newWords: newWords.map(w => ({
      wordId: w.id,
      word: w.word,
      rank: w.rank,
    })),
    stats: {
      dueReviewCount: dueCards.length,
      newWordCount: newWords.length,
      newWordsStudiedToday,
      remainingNewWords,
      availableLearningCount,
    },
    session: todaySession,
  };
});
