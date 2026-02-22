import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleChats } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');

  const db = useDB();
  await requireEntity(db, articles, id, '文章');

  await db.delete(articleChats).where(eq(articleChats.articleId, id));

  return { success: true };
});
