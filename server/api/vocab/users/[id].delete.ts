import { eq } from 'drizzle-orm';
import { vocabUsers, vocabSettings } from '../../../database/schemas/vocab';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '用户');

  const db = useDB();

  // 检查用户是否存在
  const existing = await db.select().from(vocabUsers).where(eq(vocabUsers.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '用户不存在' });
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
