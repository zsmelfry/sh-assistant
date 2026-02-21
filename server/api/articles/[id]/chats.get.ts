import { eq, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleChats } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');

  const db = useDB();

  // Check article existence
  const article = await db.select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (article.length === 0) {
    throw createError({ statusCode: 404, message: '文章不存在' });
  }

  const chats = await db.select()
    .from(articleChats)
    .where(eq(articleChats.articleId, id))
    .orderBy(asc(articleChats.createdAt));

  return chats;
});
