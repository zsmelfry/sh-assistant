import { readdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { useAdminDB, clearUserDbCache } from '~/server/database';
import { users, userModules } from '~/server/database/admin-schema';
import { getDataDir } from '~/server/utils/data-dir';

export default defineEventHandler(async () => {
  // 1. Clear admin.db
  const adminDb = useAdminDB();
  await adminDb.delete(userModules);
  await adminDb.delete(users);

  // 2. Close all cached user DB connections before deleting files
  clearUserDbCache();

  // 3. Delete all user DB files
  const usersDir = resolve(getDataDir(), 'users');
  if (existsSync(usersDir)) {
    const files = readdirSync(usersDir).filter((f) => f.endsWith('.db') || f.endsWith('.db-wal') || f.endsWith('.db-shm'));
    for (const file of files) {
      unlinkSync(resolve(usersDir, file));
    }
  }

  return { success: true };
});
