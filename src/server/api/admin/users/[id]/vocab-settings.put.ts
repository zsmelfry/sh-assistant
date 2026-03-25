import { eq } from 'drizzle-orm';
import { useAdminDB, useUserDB } from '~/server/database';
import { users } from '~/server/database/admin-schema';
import { vocabSettings } from '~/server/database/schemas/vocab';

const ALLOWED_KEYS = ['multi_wordbook_enabled'] as const;

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的用户 ID' });
  }

  const body = await readBody(event);
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体无效' });
  }
  const { key, value } = body;

  if (!key || !ALLOWED_KEYS.includes(key)) {
    throw createError({ statusCode: 400, message: `不支持的设置项: ${key}` });
  }

  if (value !== 'true' && value !== 'false' && value !== '') {
    throw createError({ statusCode: 400, message: '值必须为 "true" 或 "false"' });
  }

  const strValue = String(value ?? '');

  // Verify user exists in admin DB
  const adminDb = useAdminDB();
  const [user] = await adminDb.select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' });
  }

  // Write to user's personal DB
  const db = useUserDB(user.username);

  const existing = await db.select().from(vocabSettings).where(eq(vocabSettings.key, key)).limit(1);

  if (existing.length > 0) {
    await db.update(vocabSettings).set({ value: strValue }).where(eq(vocabSettings.key, key));
  } else {
    await db.insert(vocabSettings).values({ key, value: strValue });
  }

  return { ok: true };
});
