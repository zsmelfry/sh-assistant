import { sql } from 'drizzle-orm';
import { vocabWords, vocabProgress, vocabUsers } from '../../database/schemas/vocab';

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

  const db = useDB();

  // 事务：清空旧数据 → 插入新词 → 重建所有用户的 progress
  // better-sqlite3 事务是同步的，不能用 async 回调
  db.transaction((tx) => {
    // 清空旧数据（级联删除 progress 和 statusHistory）
    tx.delete(vocabProgress).run();
    tx.run(sql`DELETE FROM vocab_status_history`);
    tx.delete(vocabWords).run();

    // 批量插入新词
    const batchSize = 500;
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      tx.insert(vocabWords).values(batch).run();
    }

    // 为所有已有用户初始化 progress（默认 UNREAD）
    const users = tx.select().from(vocabUsers).all();
    if (users.length > 0) {
      const allWords = tx.select({ id: vocabWords.id }).from(vocabWords).all();
      for (const user of users) {
        for (let i = 0; i < allWords.length; i += batchSize) {
          const batch = allWords.slice(i, i + batchSize).map(w => ({
            userId: user.id,
            wordId: w.id,
            learningStatus: 'unread' as const,
            isRead: false,
            isMastered: false,
          }));
          tx.insert(vocabProgress).values(batch).run();
        }
      }
    }
  });

  return { imported: words.length };
});
