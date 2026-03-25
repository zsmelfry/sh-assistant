import { useDB } from '~/server/database';
import { eq, sql } from 'drizzle-orm';
import { vocabWords, vocabProgress, wordbooks } from '../../database/schemas/vocab';
import { getLanguageConfig } from '~/server/lib/vocab/languages';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { csv, wordbookName, language: rawLanguage } = body;
  const language = rawLanguage || 'fr';

  if (!csv || typeof csv !== 'string') {
    throw createError({ statusCode: 400, message: 'csv field is required' });
  }

  // Validate language code
  const langConfig = getLanguageConfig(language);

  const lines = csv.trim().split('\n');
  if (lines.length < 2) {
    throw createError({ statusCode: 400, message: 'CSV must have header and at least one data row' });
  }

  // 解析 header — support both 'word' and language-specific aliases (e.g. 'french_word')
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rankIdx = header.indexOf('rank');
  let wordIdx = header.indexOf('word');
  if (wordIdx === -1) {
    wordIdx = header.indexOf(langConfig.csvColumnAlias);
  }
  // Fallback: try 'french_word' for backward compatibility
  if (wordIdx === -1) {
    wordIdx = header.indexOf('french_word');
  }

  if (rankIdx === -1 || wordIdx === -1) {
    throw createError({
      statusCode: 400,
      message: 'CSV must have "rank" and "word" (or "french_word") columns',
    });
  }

  // 解析数据行
  const words: { rank: number; word: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const rank = parseInt(cols[rankIdx], 10);
    const word = cols[wordIdx];

    if (isNaN(rank) || !word) continue;
    words.push({ rank, word });
  }

  if (words.length === 0) {
    throw createError({ statusCode: 400, message: 'No valid words found in CSV' });
  }

  const db = useDB(event);
  const batchSize = 500;
  const multiEnabled = isMultiWordbookEnabled(db);

  if (multiEnabled) {
    // Multi-wordbook mode
    const activeWb = getActiveWordbook(db);
    const activeIsEmpty = activeWb.wordCount === 0;

    if (activeIsEmpty) {
      // Active wordbook has 0 words — import into it instead of creating new
      db.transaction((tx: any) => {
        // Batch insert words into the existing active wordbook
        for (let i = 0; i < words.length; i += batchSize) {
          tx.insert(vocabWords).values(
            words.slice(i, i + batchSize).map(w => ({
              rank: w.rank,
              word: w.word,
              wordbookId: activeWb.id,
            })),
          ).run();
        }

        // Update word count and language (in case user picked a different language)
        tx.update(wordbooks).set({
          wordCount: words.length,
          language,
        }).where(eq(wordbooks.id, activeWb.id)).run();

        // Update name if provided
        if (wordbookName) {
          tx.update(wordbooks).set({ name: wordbookName }).where(eq(wordbooks.id, activeWb.id)).run();
        }
      });
    } else {
      // Active wordbook has words — create a new wordbook
      const name = wordbookName || `${langConfig.displayName}词汇本`;
      const now = Date.now();

      db.transaction((tx: any) => {
        // Deactivate all existing wordbooks
        tx.update(wordbooks).set({ isActive: false }).run();

        // Create new wordbook (active)
        const result = tx.insert(wordbooks).values({
          name,
          language,
          isActive: true,
          wordCount: words.length,
          createdAt: now,
        }).returning().get();

        const wordbookId = result.id;

        // Batch insert words into the new wordbook
        for (let i = 0; i < words.length; i += batchSize) {
          tx.insert(vocabWords).values(
            words.slice(i, i + batchSize).map(w => ({
              rank: w.rank,
              word: w.word,
              wordbookId,
            })),
          ).run();
        }
      });
    }
  } else {
    // Single-wordbook mode: replace the existing wordbook's data (keep current behavior)
    db.transaction((tx: any) => {
      // Get the single active wordbook (or the first one)
      const existing = tx.select().from(wordbooks).limit(1).get();

      let wordbookId: number;

      if (existing) {
        wordbookId = existing.id;

        // Clear old data for this wordbook
        // Delete progress for words in this wordbook
        tx.run(sql`DELETE FROM vocab_progress WHERE word_id IN (SELECT id FROM vocab_words WHERE wordbook_id = ${wordbookId})`);
        tx.run(sql`DELETE FROM vocab_status_history WHERE word_id IN (SELECT id FROM vocab_words WHERE wordbook_id = ${wordbookId})`);
        tx.run(sql`DELETE FROM srs_cards WHERE word_id IN (SELECT id FROM vocab_words WHERE wordbook_id = ${wordbookId})`);
        tx.run(sql`DELETE FROM review_logs WHERE word_id IN (SELECT id FROM vocab_words WHERE wordbook_id = ${wordbookId})`);
        tx.run(sql`DELETE FROM definitions WHERE word_id IN (SELECT id FROM vocab_words WHERE wordbook_id = ${wordbookId})`);
        tx.delete(vocabWords).where(eq(vocabWords.wordbookId, wordbookId)).run();

        // Update wordbook metadata
        tx.update(wordbooks).set({
          ...(wordbookName ? { name: wordbookName } : {}),
          language,
          wordCount: words.length,
          isActive: true,
        }).where(eq(wordbooks.id, wordbookId)).run();
      } else {
        // No wordbook exists yet — create one
        const result = tx.insert(wordbooks).values({
          name: wordbookName || `${langConfig.displayName}词汇本`,
          language,
          isActive: true,
          wordCount: words.length,
          createdAt: Date.now(),
        }).returning().get();
        wordbookId = result.id;
      }

      // Batch insert new words
      for (let i = 0; i < words.length; i += batchSize) {
        tx.insert(vocabWords).values(
          words.slice(i, i + batchSize).map(w => ({
            rank: w.rank,
            word: w.word,
            wordbookId,
          })),
        ).run();
      }
    });
  }

  return { imported: words.length };
});
