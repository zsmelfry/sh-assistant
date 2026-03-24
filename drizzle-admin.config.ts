import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/database/admin-schema.ts',
  out: './src/server/database/admin-migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.ADMIN_DB_PATH || './data/admin.db',
  },
});
