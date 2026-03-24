import { useDB } from '~/server/database';
import { ptTags } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  return db.select().from(ptTags).orderBy(ptTags.name);
});
