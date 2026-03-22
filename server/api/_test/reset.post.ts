import { readdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { useAdminDB } from '~/server/database';
import { users, userModules } from '~/server/database/admin-schema';

export default defineEventHandler(async () => {
  // 1. Clear admin.db
  const adminDb = useAdminDB();
  await adminDb.delete(userModules);
  await adminDb.delete(users);

  // 2. Delete all user DB files
  const usersDir = resolve('./data/users');
  if (existsSync(usersDir)) {
    const files = readdirSync(usersDir).filter((f) => f.endsWith('.db') || f.endsWith('.db-wal') || f.endsWith('.db-shm'));
    for (const file of files) {
      unlinkSync(resolve(usersDir, file));
    }
  }

  return { success: true };
});
