import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleTranslations } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的文章 ID' });
  }

  const db = useDB();

  // 检查文章是否存在
  const article = await db.select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (article.length === 0) {
    throw createError({ statusCode: 404, message: '文章不存在' });
  }

  // 获取所有翻译
  const translations = await db.select()
    .from(articleTranslations)
    .where(eq(articleTranslations.articleId, id));

  // 按 type 组织返回
  const result: Record<string, { id: number; content: string; providerId: number | null; createdAt: number }> = {};
  for (const t of translations) {
    result[t.type] = {
      id: t.id,
      content: t.content,
      providerId: t.providerId,
      createdAt: t.createdAt,
    };
  }

  return result;
});
