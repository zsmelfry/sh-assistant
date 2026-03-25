import { eq } from 'drizzle-orm';
import { useAdminDB, useUserDB } from '~/server/database';
import { users } from '~/server/database/admin-schema';
import { vocabSettings } from '~/server/database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的用户 ID' });
  }

  // Verify user exists in admin DB
  const adminDb = useAdminDB();
  const [user] = await adminDb.select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' });
  }

  // Read from user's personal DB
  const db = useUserDB(user.username);
  const rows = await db.select().from(vocabSettings).where(eq(vocabSettings.key, 'multi_wordbook_enabled')).limit(1);

  const multiWordbookEnabled = rows.length > 0 && rows[0].value === 'true';

  return { multiWordbookEnabled };
});
