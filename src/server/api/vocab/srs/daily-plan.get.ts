import { useDB } from '~/server/database';
import { eq, lte, sql, inArray, and } from 'drizzle-orm';
import { srsCards, studySessions } from '../../../database/schemas/srs';
import { vocabProgress, vocabWords, LEARNING_STATUS } from '../../../database/schemas/vocab';
import { NEW_WORDS_PER_SESSION, MAX_REVIEWS_PER_SESSION } from '../../../utils/srs-algorithm';
import { formatDate } from '../../../utils/date';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const now = Date.now();
  const today = formatDate(new Date());

  // Scope to active wordbook
  const activeWordbook = getActiveWordbook(db);

  // 1. 获取到期需要复习的卡片（排除 MASTERED 状态的单词）
  const allCards = await db.select({
    card: srsCards,
    word: vocabWords,
  })
    .from(srsCards)
    .innerJoin(vocabWords, eq(srsCards.wordId, vocabWords.id))
    .where(and(lte(srsCards.nextReviewAt, now), eq(vocabWords.wordbookId, activeWordbook.id)));

  // 获取已掌握单词 ID 集合
  const masteredProgress = await db.select({ wordId: vocabProgress.wordId })
    .from(vocabProgress)
    .where(eq(vocabProgress.learningStatus, LEARNING_STATUS.MASTERED));
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
    .where(eq(studySessions.date, today))
    .limit(1);

  const todaySession = sessionResult[0] || null;
  const newWordsStudiedToday = todaySession?.newWordsStudied || 0;
  const remainingNewWords = Math.max(0, NEW_WORDS_PER_SESSION - newWordsStudiedToday);

  // 3. 获取新词（从 LEARNING 状态中取还没有 SRS 卡片的，限定活跃词汇本）
  let newWords: Array<{ id: number; rank: number; word: string }> = [];
  if (remainingNewWords > 0) {
    // 已有 SRS 卡片的 wordId
    const existingCardWords = await db.select({ wordId: srsCards.wordId })
      .from(srsCards);
    const existingWordIds = new Set(existingCardWords.map(c => c.wordId));

    // LEARNING 状态的 wordId（限定活跃词汇本）
    const learningProgress = await db.all(sql`
      SELECT p.word_id as wordId
      FROM vocab_progress p
      INNER JOIN vocab_words w ON p.word_id = w.id
      WHERE p.learning_status = ${LEARNING_STATUS.LEARNING}
        AND w.wordbook_id = ${activeWordbook.id}
    `) as Array<{ wordId: number }>;

    const learningWordIds = learningProgress
      .filter(p => !existingWordIds.has(p.wordId))
      .map(p => p.wordId);

    if (learningWordIds.length > 0) {
      // 按 rank 排序取前 N 个（使用 SQL inArray 过滤，避免全表扫描）
      newWords = await db.select()
        .from(vocabWords)
        .where(inArray(vocabWords.id, learningWordIds))
        .orderBy(vocabWords.rank)
        .limit(remainingNewWords);
    }
  }

  // 4. 可学新词总数（用于前端显示，限定活跃词汇本）
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
