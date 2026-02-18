import { vocabUsers, vocabSettings } from '../../database/schemas/vocab';
import { initProgressForUser } from '../../utils/vocab-progress';

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
  await initProgressForUser(db, user.id);

  // 设置为当前用户
  await db.insert(vocabSettings)
    .values({ key: 'lastUserId', value: String(user.id) })
    .onConflictDoUpdate({ target: vocabSettings.key, set: { value: String(user.id) } });

  return user;
});
