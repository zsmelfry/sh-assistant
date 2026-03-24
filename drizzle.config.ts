import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/database/schema.ts',
  out: './src/server/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/assistant.db',
  },
});
