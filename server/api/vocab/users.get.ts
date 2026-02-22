import { useDB } from '~/server/database';
import { vocabUsers, vocabSettings } from '../../database/schemas/vocab';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async () => {
  const db = useDB();

  const users = await db.select().from(vocabUsers).orderBy(vocabUsers.createdAt);

  // 获取上次使用的用户 ID
  const lastUserSetting = await db.select()
    .from(vocabSettings)
    .where(eq(vocabSettings.key, 'lastUserId'))
    .limit(1);

  const lastUserId = lastUserSetting[0]?.value ? Number(lastUserSetting[0].value) : null;

  return { users, lastUserId };
});
