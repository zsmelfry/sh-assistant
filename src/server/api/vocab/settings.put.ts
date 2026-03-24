import { useDB } from '~/server/database';
import { vocabSettings } from '../../database/schemas/vocab';
import { eq } from 'drizzle-orm';

const ALLOWED_KEYS = ['example_interest_context'] as const;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { key, value } = body;

  // Validate key
  if (!key || !ALLOWED_KEYS.includes(key)) {
    throw createError({ statusCode: 400, message: `不支持的设置项: ${key}` });
  }

  // Validate value
  const strValue = String(value ?? '');
  if (strValue.length > 20) {
    throw createError({ statusCode: 400, message: '设置值不能超过20个字符' });
  }
  if (strValue && !/^[\u4e00-\u9fff\w\s]*$/.test(strValue)) {
    throw createError({ statusCode: 400, message: '设置值只能包含中文、英文、数字和空格' });
  }

  const db = useDB(event);

  // Upsert: try update first, insert if not exists
  const existing = await db.select().from(vocabSettings).where(eq(vocabSettings.key, key)).limit(1);

  if (existing.length > 0) {
    await db.update(vocabSettings).set({ value: strValue }).where(eq(vocabSettings.key, key));
  } else {
    await db.insert(vocabSettings).values({ key, value: strValue });
  }

  return { ok: true };
});
