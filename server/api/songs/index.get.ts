import { like, desc, eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { songs } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const search = (query.search as string)?.trim();
  const year = query.year ? Number(query.year) : undefined;

  const db = useDB();
  let q = db.select().from(songs).$dynamic();

  const conditions = [];
  if (search) {
    conditions.push(like(songs.title, `%${search}%`));
  }
  if (year) {
    conditions.push(eq(songs.year, year));
  }

  if (conditions.length > 0) {
    q = q.where(and(...conditions));
  }

  return q.orderBy(desc(songs.updatedAt)).limit(200);
});
