import { eq } from 'drizzle-orm';
import { vocabUsers, vocabSettings } from '../../../database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid user id' });
  }

  const db = useDB();

  // 检查用户是否存在
  const existing = await db.select().from(vocabUsers).where(eq(vocabUsers.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: 'User not found' });
  }

  // 级联删除（progress、statusHistory 会被级联删除）
  await db.delete(vocabUsers).where(eq(vocabUsers.id, id));

  // 如果删除的是当前用户，清除 lastUserId
  const lastUserSetting = await db.select()
    .from(vocabSettings)
    .where(eq(vocabSettings.key, 'lastUserId'))
    .limit(1);

  if (lastUserSetting[0]?.value === String(id)) {
    await db.update(vocabSettings)
      .set({ value: null })
      .where(eq(vocabSettings.key, 'lastUserId'));
  }

  return { success: true };
});
