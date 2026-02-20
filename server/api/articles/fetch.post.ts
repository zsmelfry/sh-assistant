import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleBookmarks, articleTagMap, articleTags } from '~/server/database/schema';
import { extractArticle } from '~/server/utils/article-extractor';
import { sanitizeArticleHtml } from '~/server/utils/article-sanitizer';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.url || typeof body.url !== 'string' || !body.url.trim()) {
    throw createError({ statusCode: 400, message: 'url 是必填字段' });
  }

  const url = body.url.trim();

  const db = useDB();

  // 检查是否已存在
  const existing = await db.select()
    .from(articles)
    .where(eq(articles.url, url))
    .limit(1);

  if (existing.length > 0) {
    // Update lastReadAt
    db.update(articles)
      .set({ lastReadAt: Date.now() })
      .where(eq(articles.id, existing[0].id))
      .run();

    // 查询收藏状态（与 [id].get.ts 一致）
    const bookmark = await db.select()
      .from(articleBookmarks)
      .where(eq(articleBookmarks.articleId, existing[0].id))
      .limit(1);

    // 查询标签
    const tagRows = await db.select({
      id: articleTags.id,
      name: articleTags.name,
      color: articleTags.color,
    })
      .from(articleTagMap)
      .innerJoin(articleTags, eq(articleTagMap.tagId, articleTags.id))
      .where(eq(articleTagMap.articleId, existing[0].id));

    return {
      ...existing[0],
      bookmark: bookmark.length > 0 ? bookmark[0] : null,
      tags: tagRows,
    };
  }

  // 抓取并提取
  const extracted = await extractArticle(url);

  // 清洗 HTML
  const sanitizedContent = sanitizeArticleHtml(extracted.content);

  const now = Date.now();
  const newArticle = {
    url,
    title: extracted.title,
    author: extracted.author,
    siteName: extracted.siteName,
    content: sanitizedContent,
    excerpt: extracted.excerpt,
    publishedAt: extracted.publishedAt,
    createdAt: now,
    lastReadAt: now,
  };

  const result = await db.insert(articles).values(newArticle).returning();

  setResponseStatus(event, 201);
  return { ...result[0], tags: [] };
});
