import { eq, and, isNull, gt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { useAdminDB } from '~/server/database';
import { users, verificationTokens, loginLogs } from '~/server/database/admin-schema';
import { hashToken } from '~/server/utils/token';
import { validatePassword } from '~/server/utils/password-validation';
import { createRateLimiter } from '~/server/utils/rate-limiter';

const resetPasswordRateLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
  messagePrefix: '操作次数过多',
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.token || typeof body.token !== 'string') {
    throw createError({ statusCode: 400, message: '缺少重置令牌' });
  }

  if (!body.password) {
    throw createError({ statusCode: 400, message: '请输入新密码' });
  }

  // Rate limit by IP
  const ip = getRequestIP(event, { xForwardedFor: true }) || getHeader(event, 'x-forwarded-for') || 'unknown';
  resetPasswordRateLimiter.check(ip);

  validatePassword(body.password);

  const db = useAdminDB();
  const now = Date.now();
  const tokenHash = hashToken(body.token);

  // Find valid reset token
  const [tokenRow] = await db.select()
    .from(verificationTokens)
    .where(and(
      eq(verificationTokens.tokenHash, tokenHash),
      eq(verificationTokens.type, 'reset'),
      isNull(verificationTokens.usedAt),
      gt(verificationTokens.expiresAt, now),
    ))
    .limit(1);

  if (!tokenRow) {
    resetPasswordRateLimiter.record(ip);
    throw createError({ statusCode: 400, message: '重置链接无效或已过期' });
  }

  // Find user by email
  const [user] = await db.select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.email, tokenRow.email))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 400, message: '关联用户不存在' });
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(body.password, 10);

  // Transaction: update password + increment tokenVersion + mark token used
  const sqlite = (db as any).$client;

  const transaction = sqlite.transaction(() => {
    // Update password and bump token version
    sqlite.prepare(
      `UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?`,
    ).run(passwordHash, user.id);

    // Mark token as used
    sqlite.prepare(
      `UPDATE verification_tokens SET used_at = ? WHERE id = ?`,
    ).run(now, tokenRow.id);
  });

  transaction();

  // Log password reset (fire-and-forget)
  try {
    db.insert(loginLogs).values({
      userId: user.id,
      username: user.username,
      method: 'password_reset',
      ip,
      createdAt: now,
    }).run();
  } catch (e) {
    console.error('Failed to log password reset:', e);
  }

  resetPasswordRateLimiter.clear(ip);

  return { success: true };
});
