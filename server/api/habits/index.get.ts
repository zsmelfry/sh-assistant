import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { habits } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  return db.select()
    .from(habits)
    .where(eq(habits.archived, false))
    .orderBy(habits.createdAt);
});
