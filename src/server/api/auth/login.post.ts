import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { useAdminDB } from '~/server/database';
import { users, userModules, loginLogs } from '~/server/database/admin-schema';

// ── Rate limiting: per-username, 5 attempts per 15 minutes ──
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(username: string): void {
  const now = Date.now();
  const record = loginAttempts.get(username);

  if (record) {
    // Reset window if expired
    if (now - record.firstAttempt > WINDOW_MS) {
      loginAttempts.delete(username);
      return;
    }
    if (record.count >= MAX_ATTEMPTS) {
      const remainingSec = Math.ceil((WINDOW_MS - (now - record.firstAttempt)) / 1000);
      throw createError({
        statusCode: 429,
        message: `登录尝试次数过多，请 ${Math.ceil(remainingSec / 60)} 分钟后再试`,
      });
    }
  }
}

function recordFailedAttempt(username: string): void {
  const now = Date.now();
  const record = loginAttempts.get(username);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(username, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

function clearAttempts(username: string): void {
  loginAttempts.delete(username);
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.username?.trim() || !body.password) {
    throw createError({ statusCode: 400, message: '用户名和密码不能为空' });
  }

  const username = body.username.trim();
  checkRateLimit(username);

  const db = useAdminDB();
  const [user] = await db.select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    recordFailedAttempt(username);
    throw createError({ statusCode: 401, message: '用户名或密码错误' });
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    recordFailedAttempt(username);
    throw createError({ statusCode: 401, message: '用户名或密码错误' });
  }

  clearAttempts(username);

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET not configured');
    throw createError({ statusCode: 500, message: 'Internal server error' });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, tokenVersion: user.tokenVersion ?? 0 },
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
