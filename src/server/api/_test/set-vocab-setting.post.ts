import { eq } from 'drizzle-orm';
import { useUserDB } from '~/server/database';
import { vocabSettings } from '~/server/database/schemas/vocab';

/**
 * Test-only endpoint: set a vocab setting for a given user.
 * Allows E2E tests to toggle multi_wordbook_enabled etc.
 * Protected by test-guard middleware (blocked in production).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { username, key, value } = body;

  if (!username || !key) {
    throw createError({ statusCode: 400, message: 'username and key required' });
  }

  const db = useUserDB(username);

  const existing = db.select().from(vocabSettings).where(eq(vocabSettings.key, key)).limit(1).get();

  if (existing) {
    db.update(vocabSettings).set({ value: String(value ?? '') }).where(eq(vocabSettings.key, key)).run();
  } else {
    db.insert(vocabSettings).values({ key, value: String(value ?? '') }).run();
  }

  return { ok: true };
});
