import { eq, and, isNull } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { users, verificationTokens, loginLogs } from '~/server/database/admin-schema';
import { generateToken, RESET_EXPIRES_MINUTES } from '~/server/utils/token';
import { sendEmail } from '~/server/utils/email';
import { resetEmailHtml } from '~/server/utils/email-templates';
import { clearAuthCache } from '~/server/middleware/02.auth';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的用户ID' });
  }

  const db = useAdminDB();

  // Get target user
  const [user] = await db.select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' });
  }

  if (!user.email) {
    throw createError({ statusCode: 400, message: '该用户未设置邮箱' });
  }

  const now = Date.now();

  // Bump tokenVersion to invalidate all sessions
  const newTokenVersion = (user.tokenVersion ?? 0) + 1;
  await db.update(users)
    .set({ tokenVersion: newTokenVersion })
    .where(eq(users.id, id));

  // Clear auth cache so token version check takes effect immediately
  clearAuthCache(user.username);

  // Delete all unused verification tokens for this user's email
  db.delete(verificationTokens)
    .where(and(
      eq(verificationTokens.email, user.email),
      isNull(verificationTokens.usedAt),
    ))
    .run();

  // Generate reset token
  const { token, hash } = generateToken();
  const expiresAt = now + RESET_EXPIRES_MINUTES * 60 * 1000;

  await db.insert(verificationTokens).values({
    email: user.email,
    tokenHash: hash,
    type: 'reset',
    expiresAt,
    createdAt: now,
  });

  // Construct reset URL
  const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  const resetUrl = `${baseUrl}/reset-password/${token}`;

  // Try send email
  let emailSent = false;
  try {
    await sendEmail(user.email, '重置密码 — 个人助手', resetEmailHtml(resetUrl, RESET_EXPIRES_MINUTES));
    emailSent = true;
  } catch (e) {
    console.warn('[force-reset] Failed to send reset email:', e);
  }

  // Log to loginLogs
  try {
    const ip = getRequestIP(event, { xForwardedFor: true }) || getHeader(event, 'x-forwarded-for') || 'unknown';
    db.insert(loginLogs).values({
      userId: user.id,
      username: user.username,
      method: 'admin_reset',
      ip,
      createdAt: now,
    }).run();
  } catch (e) {
    console.error('Failed to log admin reset:', e);
  }

  return { resetUrl, emailSent };
});
