import { eq } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { users } from '~/server/database/admin-schema';
import { clearAuthCache } from '~/server/middleware/02.auth';

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth?.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const db = useAdminDB();

  const [user] = await db.select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' });
  }

  // Bump tokenVersion to invalidate all sessions
  await db.update(users)
    .set({ tokenVersion: (user.tokenVersion ?? 0) + 1 })
    .where(eq(users.id, auth.userId));

  // Clear auth cache so token version check takes effect immediately
  clearAuthCache(auth.username);

  return { success: true };
});
