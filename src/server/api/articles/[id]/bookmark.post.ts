import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleBookmarks } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { logActivity } from '~/server/lib/ability/log-activity';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');

  const db = useDB(event);

  // 检查文章存在
  const article = await db.select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (article.length === 0) {
    throw createError({ statusCode: 404, message: '文章不存在' });
  }

  // 检查是否已收藏
  const existing = await db.select()
    .from(articleBookmarks)
    .where(eq(articleBookmarks.articleId, id))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const body = await readBody(event) || {};

  const result = await db.insert(articleBookmarks).values({
    articleId: id,
    notes: body.notes || null,
    bookmarkedAt: Date.now(),
  }).returning();

  // Get article title for activity log
  const [articleRow] = await db.select({ title: articles.title }).from(articles).where(eq(articles.id, id)).limit(1);
  logActivity(db, {
    source: 'article',
    sourceRef: `article:${id}`,
    description: `收藏文章：${articleRow?.title ?? '未知'}`,
  }).catch(() => {});

  setResponseStatus(event, 201);
  return result[0];
});
