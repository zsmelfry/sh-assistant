import { asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articleTags } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const db = useDB(event);

  const tags = await db.select()
    .from(articleTags)
    .orderBy(asc(articleTags.name));

  return tags;
});
