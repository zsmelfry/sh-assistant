import { eq, and } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { verificationTokens } from '~/server/database/admin-schema';
import { hashToken } from '~/server/utils/token';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.token || typeof body.token !== 'string') {
    return { valid: false, reason: 'invalid' as const };
  }

  const type = body.type === 'reset' ? 'reset' : 'invite';
  const db = useAdminDB();
  const tokenHash = hashToken(body.token);

  const [tokenRow] = await db.select({
    email: verificationTokens.email,
    expiresAt: verificationTokens.expiresAt,
    usedAt: verificationTokens.usedAt,
  })
    .from(verificationTokens)
    .where(and(
      eq(verificationTokens.tokenHash, tokenHash),
      eq(verificationTokens.type, type),
    ))
    .limit(1);

  if (!tokenRow) {
    return { valid: false, reason: 'invalid' as const };
  }

  if (tokenRow.usedAt) {
    return { valid: false, reason: 'used' as const };
  }

  if (tokenRow.expiresAt <= Date.now()) {
    return { valid: false, reason: 'expired' as const };
  }

  return { valid: true, email: tokenRow.email };
});
