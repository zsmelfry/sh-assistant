import { eq, and, isNull, gt } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { verificationTokens } from '~/server/database/admin-schema';
import { generateToken } from '~/server/utils/token';
import { sendEmail } from '~/server/utils/email';
import { inviteEmailHtml } from '~/server/utils/email-templates';

const INVITE_EXPIRES_HOURS = 72;

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的邀请ID' });
  }

  const db = useAdminDB();
  const now = Date.now();

  // Find the existing invite
  const [oldInvite] = await db.select()
    .from(verificationTokens)
    .where(and(
      eq(verificationTokens.id, id),
      eq(verificationTokens.type, 'invite'),
      isNull(verificationTokens.usedAt),
      gt(verificationTokens.expiresAt, now),
    ))
    .limit(1);

  if (!oldInvite) {
    throw createError({ statusCode: 404, message: '邀请不存在或已过期' });
  }

  // Mark old token as used
  db.update(verificationTokens)
    .set({ usedAt: now })
    .where(eq(verificationTokens.id, id))
    .run();

  // Generate new token with same email/role/modules
  const { token, hash } = generateToken();
  const expiresAt = now + INVITE_EXPIRES_HOURS * 60 * 60 * 1000;

  const [inserted] = await db.insert(verificationTokens).values({
    email: oldInvite.email,
    tokenHash: hash,
    type: 'invite',
    role: oldInvite.role,
    modules: oldInvite.modules,
    expiresAt,
    createdAt: now,
  }).returning();

  // Construct invite URL
  const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  const inviteUrl = `${baseUrl}/invite/${token}`;

  // Try to send email
  let emailSent = false;
  try {
    await sendEmail(oldInvite.email, '您收到了一份邀请 — 个人助手', inviteEmailHtml(inviteUrl, INVITE_EXPIRES_HOURS));
    emailSent = true;
  } catch (e) {
    console.warn('[invite] Failed to resend invite email:', e);
  }

  return {
    id: inserted.id,
    email: oldInvite.email,
    inviteUrl,
    emailSent,
  };
});
