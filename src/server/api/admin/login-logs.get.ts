import { desc, eq } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { loginLogs } from '~/server/database/admin-schema';

export default defineEventHandler((event) => {
  const query = getQuery(event);

  const userId = query.userId ? Number(query.userId) : null;
  let limit = query.limit ? Number(query.limit) : 50;
  if (limit > 200) limit = 200;
  if (limit < 1) limit = 50;

  const db = useAdminDB();

  const qb = db.select()
    .from(loginLogs)
    .orderBy(desc(loginLogs.createdAt))
    .limit(limit);

  if (userId) {
    return qb.where(eq(loginLogs.userId, userId));
  }

  return qb;
});
