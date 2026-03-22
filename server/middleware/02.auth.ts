import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { users, userModules } from '~/server/database/admin-schema';

// ── 60-second in-memory cache for user role & enabled modules ──

interface AuthCacheEntry {
  role: string;
  enabledModules: string[];
  timestamp: number;
}

const AUTH_CACHE_TTL = 60_000; // 60 seconds
const authCache = new Map<string, AuthCacheEntry>();

/** Clear cached auth data for a specific user (call when admin changes permissions) */
export function clearAuthCache(username: string) {
  authCache.delete(username);
}

function getCachedAuth(username: string): AuthCacheEntry | null {
  const entry = authCache.get(username);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > AUTH_CACHE_TTL) {
    authCache.delete(username);
    return null;
  }
  return entry;
}

function fetchAndCacheAuth(username: string): AuthCacheEntry {
  const adminDb = useAdminDB();

  const user = adminDb.select({ role: users.role, id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .get();

  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const modules = adminDb.select({ moduleId: userModules.moduleId })
    .from(userModules)
    .where(eq(userModules.userId, user.id))
    .all()
    .map(m => m.moduleId);

  const entry: AuthCacheEntry = {
    role: user.role,
    enabledModules: modules,
    timestamp: Date.now(),
  };

  authCache.set(username, entry);
  return entry;
}

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname;

  // Whitelist: skip auth for these paths
  if (
    !pathname.startsWith('/api/') ||
    pathname.startsWith('/api/_test/') ||
    (pathname === '/api/auth/login' && event.method === 'POST')
  ) {
    return;
  }

  const authHeader = getRequestHeader(event, 'authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET not configured');
    throw createError({ statusCode: 500, message: 'Internal server error' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string' || typeof decoded.userId !== 'number' || typeof decoded.username !== 'string') {
      throw createError({ statusCode: 401, message: 'Invalid token payload' });
    }

    // Look up role & enabled modules from admin DB (with 60s cache)
    const cached = getCachedAuth(decoded.username);
    const authData = cached || fetchAndCacheAuth(decoded.username);

    event.context.auth = {
      userId: decoded.userId,
      username: decoded.username,
      role: authData.role,
      enabledModules: authData.enabledModules,
    };
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) throw err;
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }
});
