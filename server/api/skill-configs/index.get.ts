import { useDB } from '~/server/database';
import { skillConfigs } from '~/server/database/schema';
import { asc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  return await db.select().from(skillConfigs).orderBy(asc(skillConfigs.sortOrder));
});
