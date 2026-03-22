import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { useAdminDB } from '~/server/database';
import { users, userModules } from '~/server/database/admin-schema';

export default defineEventHandler(async () => {
  const db = useAdminDB();

  const allUsers = await db.select().from(users).orderBy(users.createdAt);
  const allModules = await db.select().from(userModules);

  return allUsers.map((u) => {
    const modules = allModules
      .filter((m) => m.userId === u.id)
      .map((m) => ({ moduleId: m.moduleId, enabled: m.enabled }));

    // Get DB file size
    let dbSize: number | null = null;
    try {
      const dbPath = resolve('./data/users', `${u.username}.db`);
      const stat = statSync(dbPath);
      dbSize = stat.size;
    } catch { /* file may not exist */ }

    return {
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
      modules,
      dbSize,
    };
  });
});
