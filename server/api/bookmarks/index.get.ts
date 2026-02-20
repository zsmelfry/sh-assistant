import { eq, desc, like, or, sql, count } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleBookmarks, articleTranslations } from '~/server/database/schema';

/** 转义 LIKE 通配符，防止用户输入 % 或 _ 导致意外匹配 */
function escapeLikePattern(s: string): string {
  return s.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = (query.search as string) || '';
  const sort = query.sort === 'publishedAt' ? 'publishedAt' : 'bookmarkedAt';

  const db = useDB();

  // 基础查询：bookmarks JOIN articles
  // 搜索匹配标题、笔记、概括
  const escapedSearch = search ? escapeLikePattern(search) : '';
  const searchConditions = search
    ? or(
        like(articles.title, `%${escapedSearch}%`),
        like(articleBookmarks.notes, `%${escapedSearch}%`),
        like(articles.excerpt, `%${escapedSearch}%`),
      )
    : undefined;

  // 排序字段
  const orderBy = sort === 'publishedAt'
    ? desc(articles.publishedAt)
    : desc(articleBookmarks.bookmarkedAt);

  // 计算总数
  const totalQuery = db.select({ count: count() })
    .from(articleBookmarks)
    .innerJoin(articles, eq(articleBookmarks.articleId, articles.id));

  if (searchConditions) {
    totalQuery.where(searchConditions);
  }

  const totalResult = await totalQuery;

  // 查询收藏列表
  const listQuery = db.select({
    bookmark: articleBookmarks,
    article: {
      id: articles.id,
      url: articles.url,
      title: articles.title,
      author: articles.author,
      siteName: articles.siteName,
      excerpt: articles.excerpt,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
    },
  })
    .from(articleBookmarks)
    .innerJoin(articles, eq(articleBookmarks.articleId, articles.id))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  if (searchConditions) {
    listQuery.where(searchConditions);
  }

  const rows = await listQuery;

  // 批量获取概括摘要（用于卡片展示）
  const articleIds = rows.map(r => r.article.id);
  let summaryMap: Record<number, string> = {};

  if (articleIds.length > 0) {
    const summaries = await db.select({
      articleId: articleTranslations.articleId,
      content: articleTranslations.content,
    })
      .from(articleTranslations)
      .where(sql`${articleTranslations.articleId} IN (${sql.join(articleIds.map(id => sql`${id}`), sql`, `)}) AND ${articleTranslations.type} = 'summary'`);

    for (const s of summaries) {
      summaryMap[s.articleId] = s.content;
    }
  }

  return {
    bookmarks: rows.map(r => ({
      ...r.article,
      bookmark: r.bookmark,
      summary: summaryMap[r.article.id] || null,
    })),
    total: totalResult[0]?.count || 0,
    page,
    limit,
  };
});
