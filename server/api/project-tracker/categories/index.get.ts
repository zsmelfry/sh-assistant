import { sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptCategories } from '~/server/database/schema';

const DEFAULT_CATEGORIES = ['生活', '工作'];

export default defineEventHandler(async () => {
  const db = useDB();

  // Auto-seed default categories on first access
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(ptCategories);
  if (count === 0) {
    const now = Date.now();
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      await db.insert(ptCategories).values({
        name: DEFAULT_CATEGORIES[i],
        sortOrder: i,
        createdAt: now,
      });
    }
  }

  return db.select().from(ptCategories).orderBy(ptCategories.sortOrder);
});
