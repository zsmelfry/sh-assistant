import { useDB } from '~/server/database';
import { sql } from 'drizzle-orm';
import { vocabWords, vocabProgress } from '../../database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { csv } = body;

  if (!csv || typeof csv !== 'string') {
    throw createError({ statusCode: 400, message: 'csv field is required' });
  }

  const lines = csv.trim().split('\n');
  if (lines.length < 2) {
    throw createError({ statusCode: 400, message: 'CSV must have header and at least one data row' });
  }

  // 解析 header
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rankIdx = header.indexOf('rank');
  const wordIdx = header.indexOf('french_word');

  if (rankIdx === -1 || wordIdx === -1) {
    throw createError({
      statusCode: 400,
      message: 'CSV must have "rank" and "french_word" columns',
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

  // 事务：清空旧数据 → 插入新词
  db.transaction((tx: any) => {
    // 清空旧数据
    tx.delete(vocabProgress).run();
    tx.run(sql`DELETE FROM vocab_status_history`);
    tx.delete(vocabWords).run();

    // 批量插入新词
    for (let i = 0; i < words.length; i += batchSize) {
      tx.insert(vocabWords).values(words.slice(i, i + batchSize)).run();
    }
  });

  return { imported: words.length };
});
