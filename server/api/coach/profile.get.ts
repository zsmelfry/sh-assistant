import { useDB } from '~/server/database';
import { coachProfile } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();

  let [profile] = await db.select().from(coachProfile);

  // Auto-create if not exists
  if (!profile) {
    const now = Date.now();
    [profile] = await db.insert(coachProfile).values({
      id: 1,
      content: '',
      currentFocus: '',
      version: 0,
      updatedAt: now,
    }).returning();
  }

  return profile;
});
