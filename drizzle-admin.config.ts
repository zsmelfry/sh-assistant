import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/database/admin-schema.ts',
  out: './server/database/admin-migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.ADMIN_DB_PATH || './data/admin.db',
  },
});
