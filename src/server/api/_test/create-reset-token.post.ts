import { eq, and, isNull } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { users, verificationTokens } from '~/server/database/admin-schema';
import { generateToken } from '~/server/utils/token';
import { RESET_EXPIRES_MINUTES } from '~/server/utils/token';

/**
 * Test-only endpoint: create a reset token and return the PLAINTEXT token.
 * This bypasses the email sending and allows E2E tests to exercise the
 * full reset-password flow.
 *
 * Protected by test-guard middleware (blocked in production).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.email) {
    throw createError({ statusCode: 400, message: 'email required' });
  }

  const email = body.email.trim().toLowerCase();
  const db = useAdminDB();

  // Verify user exists
  const [user] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: 'user not found' });
  }

  const now = Date.now();

  // Invalidate existing reset tokens
  db.update(verificationTokens)
    .set({ usedAt: now })
    .where(and(
      eq(verificationTokens.email, email),
      eq(verificationTokens.type, 'reset'),
      isNull(verificationTokens.usedAt),
    ))
    .run();

  // Generate new reset token
  const { token, hash } = generateToken();
  const expiresAt = now + RESET_EXPIRES_MINUTES * 60 * 1000;

  db.insert(verificationTokens).values({
    email,
    tokenHash: hash,
    type: 'reset',
    expiresAt,
    createdAt: now,
  }).run();

  // Return plaintext token (test only!)
  return { token, expiresAt };
});
