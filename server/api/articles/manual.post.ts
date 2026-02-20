import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles } from '~/server/database/schema';
import { sanitizeArticleHtml } from '~/server/utils/article-sanitizer';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { title, content, url } = body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw createError({ statusCode: 400, message: '标题不能为空' });
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    throw createError({ statusCode: 400, message: '正文内容不能为空' });
  }

  if (url && typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'url 必须是字符串' });
  }

  const db = useDB();

  // If URL provided, check for duplicate
  const articleUrl = url?.trim() || `manual://${Date.now()}`;
  const existing = await db.select()
    .from(articles)
    .where(eq(articles.url, articleUrl))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Sanitize content (same pipeline as auto-extracted articles)
  const sanitizedContent = sanitizeArticleHtml(content);

  const result = await db.insert(articles).values({
    url: articleUrl,
    title: title.trim(),
    author: null,
    siteName: null,
    content: sanitizedContent,
    excerpt: content.trim().slice(0, 200),
    publishedAt: null,
    createdAt: Date.now(),
    lastReadAt: Date.now(),
  }).returning();

  setResponseStatus(event, 201);
  return result[0];
});
