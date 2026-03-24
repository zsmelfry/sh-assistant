import { eq, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleChats } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');

  const db = useDB(event);
  await requireEntity(db, articles, id, '文章');

  const chats = await db.select()
    .from(articleChats)
    .where(eq(articleChats.articleId, id))
    .orderBy(asc(articleChats.createdAt));

  return chats;
});
