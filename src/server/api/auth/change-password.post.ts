import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { useAdminDB } from '~/server/database';
import { users } from '~/server/database/admin-schema';
import { validatePassword } from '~/server/utils/password-validation';
import { clearAuthCache } from '~/server/middleware/02.auth';

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth?.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event);

  if (!body.currentPassword || !body.newPassword) {
    throw createError({ statusCode: 400, message: '当前密码和新密码不能为空' });
  }

  const db = useAdminDB();

  const [user] = await db.select()
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' });
  }

  // Verify current password
  const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
  if (!valid) {
    throw createError({ statusCode: 401, message: '当前密码不正确' });
  }

  // Validate new password
  validatePassword(body.newPassword);

  // Update password + bump tokenVersion in transaction
  const newPasswordHash = await bcrypt.hash(body.newPassword, 10);
  const newTokenVersion = (user.tokenVersion ?? 0) + 1;

  await db.update(users)
    .set({
      passwordHash: newPasswordHash,
      tokenVersion: newTokenVersion,
    })
    .where(eq(users.id, auth.userId));

  // Clear auth cache so new token version is recognized immediately
  clearAuthCache(user.username);

  // Sign new JWT so current session stays valid
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw createError({ statusCode: 500, message: 'Internal server error' });
  }

  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tokenVersion: newTokenVersion,
    },
    secret,
    { expiresIn: '30d' },
  );

  return { token };
});
