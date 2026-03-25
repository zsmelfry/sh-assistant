import { and, gt, isNull, eq } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { verificationTokens } from '~/server/database/admin-schema';

export default defineEventHandler(async () => {
  const db = useAdminDB();
  const now = Date.now();

  const invites = await db.select({
    id: verificationTokens.id,
    email: verificationTokens.email,
    role: verificationTokens.role,
    expiresAt: verificationTokens.expiresAt,
    createdAt: verificationTokens.createdAt,
  })
    .from(verificationTokens)
    .where(and(
      eq(verificationTokens.type, 'invite'),
      isNull(verificationTokens.usedAt),
      gt(verificationTokens.expiresAt, now),
    ));

  return invites;
});
