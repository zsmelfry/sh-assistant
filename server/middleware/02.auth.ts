import jwt from 'jsonwebtoken';

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
    event.context.auth = { userId: decoded.userId, username: decoded.username };
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) throw err;
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }
});
