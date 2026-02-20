import { desc, count, isNotNull, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleBookmarks } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const db = useDB();

  // Only articles that have been read (lastReadAt is set)
  const readCondition = isNotNull(articles.lastReadAt);

  const [rows, totalResult] = await Promise.all([
    db.select({
      id: articles.id,
      url: articles.url,
      title: articles.title,
      author: articles.author,
      siteName: articles.siteName,
      excerpt: articles.excerpt,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      lastReadAt: articles.lastReadAt,
      // Include bookmark status as a boolean
      isBookmarked: sql<boolean>`EXISTS (
        SELECT 1 FROM ${articleBookmarks}
        WHERE ${articleBookmarks.articleId} = ${articles.id}
      )`,
    })
      .from(articles)
      .where(readCondition)
      .orderBy(desc(articles.lastReadAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() })
      .from(articles)
      .where(readCondition),
  ]);

  return {
    articles: rows,
    total: totalResult[0]?.count || 0,
    page,
    limit,
  };
});
