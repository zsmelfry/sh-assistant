import { useDB } from '~/server/database';
import { eq, inArray } from 'drizzle-orm';
import { wordbooks, vocabWords, vocabProgress, vocabStatusHistory } from '~/server/database/schemas/vocab';
import { srsCards, reviewLogs, definitions } from '~/server/database/schemas/srs';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const id = Number(getRouterParam(event, 'id'));

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的词汇本ID' });
  }

  // Delete in transaction: cascade delete related data for words in this wordbook
  db.transaction((tx) => {
    // Validate wordbook exists (inside transaction to prevent race conditions)
    const wordbook = getWordbookById(tx, id);

    // Cannot delete the active wordbook
    if (wordbook.isActive) {
      throw createError({ statusCode: 400, message: '不能删除当前活跃的词汇本' });
    }

    // Cannot delete if it's the only wordbook
    const allWordbooks = tx.select().from(wordbooks).all();
    if (allWordbooks.length <= 1) {
      throw createError({ statusCode: 400, message: '不能删除唯一的词汇本' });
    }

    // Get all word IDs in this wordbook
    const wordRows = tx.select({ id: vocabWords.id })
      .from(vocabWords)
      .where(eq(vocabWords.wordbookId, id))
      .all();

    const wordIds = wordRows.map(w => w.id);

    if (wordIds.length > 0) {
      // Delete in chunks of 500 to avoid SQLite variable limits
      for (let i = 0; i < wordIds.length; i += 500) {
        const chunk = wordIds.slice(i, i + 500);

        // Delete review logs (references srs_cards, which references words)
        tx.delete(reviewLogs)
          .where(inArray(reviewLogs.wordId, chunk))
          .run();

        // Delete SRS cards
        tx.delete(srsCards)
          .where(inArray(srsCards.wordId, chunk))
          .run();

        // Delete definitions
        tx.delete(definitions)
          .where(inArray(definitions.wordId, chunk))
          .run();

        // Delete vocab progress
        tx.delete(vocabProgress)
          .where(inArray(vocabProgress.wordId, chunk))
          .run();

        // Delete status history
        tx.delete(vocabStatusHistory)
          .where(inArray(vocabStatusHistory.wordId, chunk))
          .run();

        // Delete vocab words
        tx.delete(vocabWords)
          .where(inArray(vocabWords.id, chunk))
          .run();
      }
    }

    // Delete the wordbook itself
    tx.delete(wordbooks)
      .where(eq(wordbooks.id, id))
      .run();
  });

  return { success: true };
});
