import { desc, eq } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { loginLogs } from '~/server/database/admin-schema';

export default defineEventHandler((event) => {
  const query = getQuery(event);

  const userId = query.userId ? Number(query.userId) : null;
  if (userId !== null && (isNaN(userId) || userId < 1)) {
    throw createError({ statusCode: 400, message: 'Invalid userId' });
  }
  let limit = query.limit ? Number(query.limit) : 50;
  if (isNaN(limit) || limit > 200) limit = 200;
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
