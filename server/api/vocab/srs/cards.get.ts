import { eq, sql } from 'drizzle-orm';
import { srsCards } from '../../../database/schemas/srs';
import { vocabWords } from '../../../database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = query.userId ? Number(query.userId) : null;

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId 是必填参数' });
  }

  const db = useDB();
  const now = Date.now();

  // Join srs_cards with vocab_words to get word text and rank
  const rows = await db
    .select({
      cardId: srsCards.id,
      wordId: srsCards.wordId,
      word: vocabWords.word,
      rank: vocabWords.rank,
      easeFactor: srsCards.easeFactor,
      interval: srsCards.interval,
      repetitions: srsCards.repetitions,
      nextReviewAt: srsCards.nextReviewAt,
      lastReviewedAt: srsCards.lastReviewedAt,
    })
    .from(srsCards)
    .innerJoin(vocabWords, eq(srsCards.wordId, vocabWords.id))
    .where(eq(srsCards.userId, userId))
    .orderBy(vocabWords.rank);

  // Compute SRS stage for each card
  const AUTO_MASTERY_INTERVAL = 21;
  const cards = rows.map(row => {
    let stage: string;
    if (row.interval >= AUTO_MASTERY_INTERVAL) {
      stage = 'mastered';
    } else if (row.nextReviewAt <= now && row.repetitions > 0) {
      stage = 'due';
    } else if (row.interval <= 6) {
      stage = 'beginner';
    } else {
      stage = 'consolidating';
    }

    return {
      ...row,
      stage,
    };
  });

  return cards;
});
