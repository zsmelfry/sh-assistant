import { useDB } from '~/server/database';
import { ptCategories } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  return db.select().from(ptCategories).orderBy(ptCategories.sortOrder);
});
