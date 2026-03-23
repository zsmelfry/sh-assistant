import { eq } from 'drizzle-orm';
import { vocabUsers } from '~/server/database/schemas/vocab';

/**
 * Ensure a vocab_users record exists for the given username.
 * Returns the vocab user ID (idempotent).
 */
export function ensureVocabUser(db: any, username: string): number {
  const existing = db.select({ id: vocabUsers.id })
    .from(vocabUsers)
    .where(eq(vocabUsers.nickname, username))
    .limit(1)
    .get();

  if (existing) return existing.id;

  const result = db.insert(vocabUsers).values({
    nickname: username,
    createdAt: Date.now(),
  }).returning({ id: vocabUsers.id }).get();

  return result.id;
}
