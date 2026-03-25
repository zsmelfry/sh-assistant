import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { useAdminDB } from '~/server/database';
import { users, userModules } from '~/server/database/admin-schema';
import { validateUsername } from '~/server/utils/username-validation';
import { initUserDB } from '~/server/utils/user-db-init';
import { ALL_MODULE_IDS } from '~/server/utils/module-ids';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.username || !body.password) {
    throw createError({ statusCode: 400, message: '用户名和密码不能为空' });
  }

  validateUsername(body.username);

  if (body.password.length < 4) {
    throw createError({ statusCode: 400, message: '密码长度至少4位' });
  }

  // Validate email (required)
  if (!body.email) {
    throw createError({ statusCode: 400, message: '邮箱不能为空' });
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(body.email)) {
    throw createError({ statusCode: 400, message: '邮箱格式不正确' });
  }

  const role = body.role === 'admin' ? 'admin' : 'user';
  const db = useAdminDB();

  // Check duplicate username
  const [existing] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.username, body.username))
    .limit(1);

  if (existing) {
    throw createError({ statusCode: 409, message: '用户名已存在' });
  }

  // Check duplicate email
  const [existingEmail] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (existingEmail) {
    throw createError({ statusCode: 409, message: '邮箱已被使用' });
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const now = Date.now();

  const [user] = await db.insert(users).values({
    username: body.username,
    passwordHash,
    role,
    email: body.email,
    createdAt: now,
  }).returning();

  // Enable specified modules (default: all for admin, none for user)
  const enabledModuleIds: string[] = Array.isArray(body.enabledModules)
    ? body.enabledModules.filter((m: string) => ALL_MODULE_IDS.includes(m as any))
    : (role === 'admin' ? [...ALL_MODULE_IDS] : []);

  if (enabledModuleIds.length > 0) {
    await db.insert(userModules).values(
      enabledModuleIds.map((moduleId) => ({
        userId: user.id,
        moduleId,
        enabled: true,
        updatedAt: now,
      })),
    );
  }

  // Create user DB
  initUserDB(body.username);

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    createdAt: user.createdAt,
    enabledModules: enabledModuleIds,
  };
});
