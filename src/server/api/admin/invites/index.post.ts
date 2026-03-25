import { eq, and, gt, isNull } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { users, verificationTokens } from '~/server/database/admin-schema';
import { validateEmail } from '~/server/utils/email-validation';
import { generateToken, INVITE_EXPIRES_HOURS } from '~/server/utils/token';
import { sendEmail } from '~/server/utils/email';
import { inviteEmailHtml } from '~/server/utils/email-templates';
import { ALL_MODULE_IDS } from '~/server/utils/module-ids';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const email = validateEmail(body.email);
  const role = body.role === 'admin' ? 'admin' : 'user';

  const enabledModules: string[] = Array.isArray(body.enabledModules)
    ? body.enabledModules.filter((m: string) => ALL_MODULE_IDS.includes(m as any))
    : (role === 'admin' ? [...ALL_MODULE_IDS] : ['vocab-tracker']);

  const db = useAdminDB();

  // Check email not already in users table
  const [existingUser] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    throw createError({ statusCode: 409, message: '该邮箱已注册' });
  }

  // Check no unexpired unused invite for this email
  const now = Date.now();
  const [existingInvite] = await db.select({ id: verificationTokens.id })
    .from(verificationTokens)
    .where(and(
      eq(verificationTokens.email, email),
      eq(verificationTokens.type, 'invite'),
      isNull(verificationTokens.usedAt),
      gt(verificationTokens.expiresAt, now),
    ))
    .limit(1);

  if (existingInvite) {
    throw createError({ statusCode: 409, message: '该邮箱已有待处理的邀请，请使用重新发送功能' });
  }

  // Generate token
  const { token, hash } = generateToken();
  const expiresAt = now + INVITE_EXPIRES_HOURS * 60 * 60 * 1000;

  // Insert verification token
  const [inserted] = await db.insert(verificationTokens).values({
    email,
    tokenHash: hash,
    type: 'invite',
    role,
    modules: JSON.stringify(enabledModules),
    expiresAt,
    createdAt: now,
  }).returning();

  // Construct invite URL
  const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    throw createError({ statusCode: 500, message: '服务器未配置 APP_BASE_URL 环境变量' });
  }
  const inviteUrl = `${baseUrl}/invite/${token}`;

  // Try to send email (don't fail if it doesn't work)
  let emailSent = false;
  try {
    await sendEmail(email, '您收到了一份邀请 — 个人助手', inviteEmailHtml(inviteUrl, INVITE_EXPIRES_HOURS));
    emailSent = true;
  } catch (e) {
    console.warn('[invite] Failed to send invite email:', e);
  }

  return {
    id: inserted.id,
    email,
    inviteUrl,
    emailSent,
  };
});
