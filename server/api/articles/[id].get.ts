import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleBookmarks } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的文章 ID' });
  }

  const db = useDB();

  const result = await db.select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (result.length === 0) {
    throw createError({ statusCode: 404, message: '文章不存在' });
  }

  // 查询收藏状态
  const bookmark = await db.select()
    .from(articleBookmarks)
    .where(eq(articleBookmarks.articleId, id))
    .limit(1);

  return {
    ...result[0],
    bookmark: bookmark.length > 0 ? bookmark[0] : null,
  };
});
