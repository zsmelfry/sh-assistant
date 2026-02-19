import { useDB } from '~/server/database';
import { plannerTags } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  return db.select().from(plannerTags).orderBy(plannerTags.name);
});
