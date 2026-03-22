/**
 * Run migrations for admin.db and all user DBs.
 * Usage: npx tsx scripts/migrate-all.ts
 */
import { execSync } from 'node:child_process';

console.log('[migrate-all] Migrating admin.db...');
execSync('npx drizzle-kit migrate --config drizzle-admin.config.ts', { stdio: 'inherit' });

console.log('[migrate-all] Migrating user DBs...');
execSync('npx tsx scripts/migrate-user-dbs.ts', { stdio: 'inherit' });

console.log('[migrate-all] All migrations complete.');
