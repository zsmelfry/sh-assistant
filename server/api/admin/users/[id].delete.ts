import { eq, and, sql } from 'drizzle-orm';
import { renameSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { useAdminDB } from '~/server/database';
import { users, userModules } from '~/server/database/admin-schema';
import { clearAuthCache } from '~/server/middleware/02.auth';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的用户 ID' });
  }

  const db = useAdminDB();

  // Verify user exists
  const [user] = await db.select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' });
  }

  // Prevent deleting the last admin
  if (user.role === 'admin') {
    const [adminCount] = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, 'admin'));

    if (adminCount.count <= 1) {
      throw createError({ statusCode: 400, message: '不能删除最后一个管理员' });
    }
  }

  // Delete from admin.db (CASCADE will remove userModules)
  await db.delete(users).where(eq(users.id, id));

  // Archive user DB file
  const userDbPath = resolve('./data/users', `${user.username}.db`);
  if (existsSync(userDbPath)) {
    const archiveDir = resolve('./data/archived');
    mkdirSync(archiveDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = resolve(archiveDir, `${user.username}-${timestamp}.db`);
    renameSync(userDbPath, archivePath);

    // Also move WAL/SHM files if they exist
    for (const ext of ['-wal', '-shm']) {
      const walPath = userDbPath + ext;
      if (existsSync(walPath)) {
        renameSync(walPath, archivePath + ext);
      }
    }
  }

  // Clear auth cache
  clearAuthCache(user.username);

  return { success: true, archived: true };
});
