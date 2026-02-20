import { asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articleTags } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();

  const tags = await db.select()
    .from(articleTags)
    .orderBy(asc(articleTags.name));

  return tags;
});
