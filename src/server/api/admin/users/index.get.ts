import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { useAdminDB, useUserDB } from '~/server/database';
import { users, userModules } from '~/server/database/admin-schema';
import { vocabSettings } from '~/server/database/schemas/vocab';
import { getDataDir } from '~/server/utils/data-dir';

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
      const dbPath = resolve(getDataDir(), 'users', `${u.username}.db`);
      const stat = statSync(dbPath);
      dbSize = stat.size;
    } catch { /* file may not exist */ }

    // Read multi_wordbook_enabled from user's personal DB
    let multiWordbookEnabled = false;
    try {
      const userDb = useUserDB(u.username);
      const rows = userDb.select().from(vocabSettings).where(eq(vocabSettings.key, 'multi_wordbook_enabled')).limit(1).all();
      multiWordbookEnabled = rows.length > 0 && rows[0].value === 'true';
    } catch { /* user DB may not exist yet */ }

    return {
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
      modules,
      dbSize,
      multiWordbookEnabled,
    };
  });
});
