import { eq, and, isNull, gt } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { verificationTokens } from '~/server/database/admin-schema';
import { generateToken, INVITE_EXPIRES_HOURS } from '~/server/utils/token';
import { sendEmail } from '~/server/utils/email';
import { inviteEmailHtml } from '~/server/utils/email-templates';

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

  // Generate new token with same email/role/modules
  const { token, hash } = generateToken();
  const expiresAt = now + INVITE_EXPIRES_HOURS * 60 * 60 * 1000;

  // Transaction: mark old token as used + insert new token atomically
  // @ts-expect-error - access underlying session for transaction
  const sqlite = db._.session.client;
  const txn = sqlite.transaction(() => {
    sqlite.prepare('UPDATE verification_tokens SET used_at = ? WHERE id = ?').run(now, id);
    const result = sqlite.prepare(
      'INSERT INTO verification_tokens (email, token_hash, type, role, modules, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(oldInvite.email, hash, 'invite', oldInvite.role, oldInvite.modules, expiresAt, now);
    return { id: result.lastInsertRowid as number };
  });
  const inserted = txn();

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
