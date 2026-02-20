import { desc, count } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

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
