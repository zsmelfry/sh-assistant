import { eq, and, isNull, gt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { useAdminDB } from '~/server/database';
import { users, userModules, verificationTokens, loginLogs } from '~/server/database/admin-schema';
import { hashToken } from '~/server/utils/token';
import { validateUsername } from '~/server/utils/username-validation';
import { validatePassword } from '~/server/utils/password-validation';
import { initUserDB } from '~/server/utils/user-db-init';
import { createRateLimiter } from '~/server/utils/rate-limiter';

const acceptInviteRateLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
  messagePrefix: '操作次数过多',
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.token || typeof body.token !== 'string') {
    throw createError({ statusCode: 400, message: '缺少邀请令牌' });
  }

  if (!body.username?.trim() || !body.password) {
    throw createError({ statusCode: 400, message: '用户名和密码不能为空' });
  }

  // Rate limit by IP
  const ip = getRequestIP(event, { xForwardedFor: true }) || getHeader(event, 'x-forwarded-for') || 'unknown';
  acceptInviteRateLimiter.check(ip);

  const username = body.username.trim();
  validateUsername(username);
  validatePassword(body.password);

  const db = useAdminDB();
  const now = Date.now();
  const tokenHash = hashToken(body.token);

  // Find valid token
  const [tokenRow] = await db.select()
    .from(verificationTokens)
    .where(and(
      eq(verificationTokens.tokenHash, tokenHash),
      eq(verificationTokens.type, 'invite'),
      isNull(verificationTokens.usedAt),
      gt(verificationTokens.expiresAt, now),
    ))
    .limit(1);

  if (!tokenRow) {
    acceptInviteRateLimiter.record(ip);
    throw createError({ statusCode: 400, message: '邀请链接无效或已过期' });
  }

  // Check username uniqueness
  const [existingUser] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser) {
    throw createError({ statusCode: 409, message: '用户名已存在' });
  }

  // Check email uniqueness (in case created between invite and accept)
  const [existingEmail] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, tokenRow.email))
    .limit(1);

  if (existingEmail) {
    throw createError({ statusCode: 409, message: '该邮箱已注册' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(body.password, 10);

  const role = tokenRow.role || 'user';
  const modules: string[] = tokenRow.modules ? JSON.parse(tokenRow.modules) : [];

  // Transaction: create user + modules + mark token used
  // Access underlying sqlite for transaction support
  // @ts-expect-error - access underlying session for transaction
  const sqlite = db._.session.client;

  const transaction = sqlite.transaction(() => {
    // 1. Create user
    const insertUserStmt = sqlite.prepare(
      `INSERT INTO users (username, password_hash, role, email, token_version, created_at) VALUES (?, ?, ?, ?, 0, ?)`,
    );
    const result = insertUserStmt.run(username, passwordHash, role, tokenRow.email, now);
    const userId = result.lastInsertRowid as number;

    // 2. Create module permissions
    if (modules.length > 0) {
      const insertModuleStmt = sqlite.prepare(
        `INSERT INTO user_modules (user_id, module_id, enabled, updated_at) VALUES (?, ?, 1, ?)`,
      );
      for (const moduleId of modules) {
        insertModuleStmt.run(userId, moduleId, now);
      }
    }

    // 3. Mark token as used
    const markUsedStmt = sqlite.prepare(
      `UPDATE verification_tokens SET used_at = ? WHERE id = ?`,
    );
    markUsedStmt.run(now, tokenRow.id);

    return userId;
  });

  const userId = transaction();

  // Initialize user DB (outside transaction, OK to fail separately)
  initUserDB(username);

  // Sign JWT
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET not configured');
    throw createError({ statusCode: 500, message: 'Internal server error' });
  }

  const jwtToken = jwt.sign(
    { userId, username, role, tokenVersion: 0 },
    secret,
    { expiresIn: '30d' },
  );

  // Log login (fire-and-forget)
  try {
    db.insert(loginLogs).values({
      userId,
      username,
      method: 'invite_setup',
      ip,
      createdAt: now,
    }).run();
  } catch (e) {
    console.error('Failed to log invite setup login:', e);
  }

  acceptInviteRateLimiter.clear(ip);

  return {
    token: jwtToken,
    role,
    enabledModules: modules,
  };
});
