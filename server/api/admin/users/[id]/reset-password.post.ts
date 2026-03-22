import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { useAdminDB } from '~/server/database';
import { users } from '~/server/database/admin-schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的用户 ID' });
  }

  const body = await readBody(event);
  if (!body.password || body.password.length < 4) {
    throw createError({ statusCode: 400, message: '密码长度至少4位' });
  }

  const db = useAdminDB();

  const [user] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' });
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  await db.update(users)
    .set({ passwordHash })
    .where(eq(users.id, id));

  return { success: true };
});
