import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { useDB } from '~/server/database';
import { users } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.username?.trim() || !body.password) {
    throw createError({ statusCode: 400, message: '用户名和密码不能为空' });
  }

  const db = useDB();
  const [user] = await db.select()
    .from(users)
    .where(eq(users.username, body.username.trim()))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 401, message: '用户名或密码错误' });
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    throw createError({ statusCode: 401, message: '用户名或密码错误' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET not configured');
    throw createError({ statusCode: 500, message: 'Internal server error' });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    secret,
    { expiresIn: '365d' },
  );

  return { token };
});
