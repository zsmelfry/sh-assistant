import { useDB } from '~/server/database';
import { habits, checkins } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  await db.delete(checkins);
  await db.delete(habits);
  return { success: true };
});
