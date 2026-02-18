import { vocabUsers, vocabProgress, vocabWords, vocabSettings } from '../../database/schemas/vocab';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { nickname } = body;

  if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'nickname is required' });
  }

  const db = useDB();
  const now = Date.now();

  // 创建用户
  const result = await db.insert(vocabUsers).values({
    nickname: nickname.trim(),
    createdAt: now,
  }).returning();

  const user = result[0];

  // 为新用户初始化所有词汇的 progress
  const allWords = await db.select({ id: vocabWords.id }).from(vocabWords);
  if (allWords.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < allWords.length; i += batchSize) {
      const batch = allWords.slice(i, i + batchSize).map(w => ({
        userId: user.id,
        wordId: w.id,
        learningStatus: 'unread',
        isRead: false,
        isMastered: false,
      }));
      await db.insert(vocabProgress).values(batch);
    }
  }

  // 设置为当前用户
  await db.insert(vocabSettings)
    .values({ key: 'lastUserId', value: String(user.id) })
    .onConflictDoUpdate({ target: vocabSettings.key, set: { value: String(user.id) } });

  return user;
});
