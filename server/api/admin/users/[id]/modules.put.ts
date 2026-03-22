import { eq, and } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { users, userModules } from '~/server/database/admin-schema';
import { ALL_MODULE_IDS } from '~/server/utils/module-ids';
import { clearAuthCache } from '~/server/middleware/02.auth';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的用户 ID' });
  }

  const body = await readBody(event);
  if (!Array.isArray(body.modules)) {
    throw createError({ statusCode: 400, message: '缺少 modules 数组' });
  }

  const db = useAdminDB();

  // Verify user exists
  const [user] = await db.select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' });
  }

  const now = Date.now();

  // Upsert each module setting
  for (const mod of body.modules) {
    if (!mod.moduleId || !ALL_MODULE_IDS.includes(mod.moduleId as any)) continue;

    const enabled = mod.enabled !== false;

    const [existing] = await db.select({ id: userModules.id })
      .from(userModules)
      .where(and(
        eq(userModules.userId, id),
        eq(userModules.moduleId, mod.moduleId),
      ))
      .limit(1);

    if (existing) {
      await db.update(userModules)
        .set({ enabled, updatedAt: now })
        .where(eq(userModules.id, existing.id));
    } else {
      await db.insert(userModules).values({
        userId: id,
        moduleId: mod.moduleId,
        enabled,
        updatedAt: now,
      });
    }
  }

  // Clear auth cache for this user
  clearAuthCache(user.username);

  // Return updated modules
  const modules = await db.select()
    .from(userModules)
    .where(eq(userModules.userId, id));

  return {
    userId: id,
    modules: modules.map((m) => ({ moduleId: m.moduleId, enabled: m.enabled })),
  };
});
