import { desc, count } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles } from '~/server/database/schema';
import { parsePagination } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { page, limit, offset } = parsePagination(query);

  const db = useDB();

  const [rows, totalResult] = await Promise.all([
    db.select()
      .from(articles)
      .orderBy(desc(articles.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(articles),
  ]);

  return {
    articles: rows,
    total: totalResult[0]?.count || 0,
    page,
    limit,
  };
});
