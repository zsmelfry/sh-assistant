import { eq, or, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { useAdminDB } from '~/server/database';
import { users, userModules, loginLogs } from '~/server/database/admin-schema';
import { createRateLimiter } from '~/server/utils/rate-limiter';

// ── Rate limiting: 5 attempts per 15 minutes per identifier ──
const loginRateLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  messagePrefix: '登录尝试次数过多',
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const rawIdentifier = (body.identifier || body.email || '').trim();
  if (!rawIdentifier || !body.password) {
    throw createError({ statusCode: 400, message: '用户名/邮箱和密码不能为空' });
  }

  const identifier = rawIdentifier.toLowerCase();
  loginRateLimiter.check(identifier);

  const db = useAdminDB();
  const isEmail = identifier.includes('@');
  const [user] = await db.select()
    .from(users)
    .where(isEmail ? eq(users.email, identifier) : eq(users.username, identifier))
    .limit(1);

  if (!user) {
    loginRateLimiter.record(identifier);
    throw createError({ statusCode: 401, message: '用户名/邮箱或密码错误' });
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    loginRateLimiter.record(identifier);
    throw createError({ statusCode: 401, message: '用户名/邮箱或密码错误' });
  }

  loginRateLimiter.clear(identifier);

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET not configured');
    throw createError({ statusCode: 500, message: 'Internal server error' });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, email: user.email, role: user.role, tokenVersion: user.tokenVersion ?? 0 },
    secret,
    { expiresIn: '30d' },
  );

  // Query enabled modules for this user
  const modules = await db.select({ moduleId: userModules.moduleId })
    .from(userModules)
    .where(and(eq(userModules.userId, user.id), eq(userModules.enabled, true)));
  const enabledModules = modules
    .filter((m) => m.moduleId)
    .map((m) => m.moduleId);

  // Log login (fire-and-forget)
  try {
    const ip = getRequestIP(event, { xForwardedFor: true }) || getHeader(event, 'x-forwarded-for') || 'unknown';
    db.insert(loginLogs).values({
      userId: user.id,
      username: user.username,
      method: 'password',
      ip,
      createdAt: Date.now(),
    }).run();
  } catch (e) {
    console.error('Failed to log login:', e);
  }

  return { token, role: user.role, enabledModules };
});
