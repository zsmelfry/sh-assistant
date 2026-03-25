import { useAdminDB } from '~/server/database';
import { loginLogs } from '~/server/database/admin-schema';

export default defineEventHandler((event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const db = useAdminDB();
  const ip = getRequestIP(event, { xForwardedFor: true }) || getHeader(event, 'x-forwarded-for') || 'unknown';

  try {
    db.insert(loginLogs).values({
      userId: auth.userId,
      username: auth.username,
      method: 'token',
      ip,
      createdAt: Date.now(),
    }).run();
  } catch (e) {
    console.error('Failed to log session start:', e);
  }

  return { success: true };
});
