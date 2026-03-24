import { useDB } from '~/server/database';
import { plannerTags } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  return db.select().from(plannerTags).orderBy(plannerTags.name);
});
