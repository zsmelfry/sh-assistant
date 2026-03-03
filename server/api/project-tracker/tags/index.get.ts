import { useDB } from '~/server/database';
import { ptTags } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  return db.select().from(ptTags).orderBy(ptTags.name);
});
