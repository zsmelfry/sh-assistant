import { eq, and, isNull } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { users, verificationTokens } from '~/server/database/admin-schema';
import { generateToken } from '~/server/utils/token';
import { RESET_EXPIRES_MINUTES } from '~/server/utils/token';
import { sendEmail } from '~/server/utils/email';
import { resetEmailHtml } from '~/server/utils/email-templates';
import { createRateLimiter } from '~/server/utils/rate-limiter';

const forgotPasswordRateLimiter = createRateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  messagePrefix: '请求次数过多',
});

const RESPONSE_MESSAGE = '如果该邮箱已注册，我们已发送重置链接';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.email?.trim()) {
    throw createError({ statusCode: 400, message: '请输入邮箱地址' });
  }

  const email = body.email.trim().toLowerCase();
  forgotPasswordRateLimiter.check(email);
  forgotPasswordRateLimiter.record(email);

  const db = useAdminDB();

  // Look up user by email
  const [user] = await db.select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // If user does NOT exist, still return 200 (prevent email enumeration)
  if (!user) {
    return { success: true, message: RESPONSE_MESSAGE };
  }

  // Invalidate any existing unused reset tokens for this email
  const now = Date.now();
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

  // Send reset email
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password/${token}`;

  try {
    await sendEmail(
      email,
      '重置密码 — 个人助手',
      resetEmailHtml(resetUrl, RESET_EXPIRES_MINUTES),
    );
  } catch (e) {
    console.error('Failed to send reset email:', e);
    // Don't fail the request — the token is already stored
  }

  return { success: true, message: RESPONSE_MESSAGE };
});
