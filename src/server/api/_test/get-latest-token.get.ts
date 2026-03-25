import { eq, and, isNull, desc } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { verificationTokens } from '~/server/database/admin-schema';

/**
 * Test-only endpoint: retrieve the latest unused verification token row.
 * Since we store only the hash, this returns the hash — not useful for reset.
 * For the full reset flow test, use POST /api/_test/create-reset-token instead.
 *
 * Protected by test-guard middleware (blocked in production).
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const email = query.email as string;
  const type = (query.type as string) || 'reset';

  if (!email) {
    throw createError({ statusCode: 400, message: 'email query param required' });
  }

  const db = useAdminDB();

  const [row] = await db.select()
    .from(verificationTokens)
    .where(and(
      eq(verificationTokens.email, email),
      eq(verificationTokens.type, type),
      isNull(verificationTokens.usedAt),
    ))
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1);

  if (!row) {
    return { found: false };
  }

  return {
    found: true,
    id: row.id,
    email: row.email,
    tokenHash: row.tokenHash,
    type: row.type,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
});
