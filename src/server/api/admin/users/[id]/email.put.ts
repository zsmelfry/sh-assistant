import { eq, and, ne } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { users } from '~/server/database/admin-schema';
import { validateEmail } from '~/server/utils/email-validation';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的用户ID' });
  }

  const body = await readBody(event);
  const email = validateEmail(body.email);

  const db = useAdminDB();

  // Check user exists
  const [user] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' });
  }

  // Check uniqueness excluding current user
  const [existing] = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, id)))
    .limit(1);

  if (existing) {
    throw createError({ statusCode: 409, message: '邮箱已被其他用户使用' });
  }

  await db.update(users)
    .set({ email })
    .where(eq(users.id, id));

  return { success: true };
});
