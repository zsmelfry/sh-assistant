import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articleBookmarks } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');

  const db = useDB();

  const existing = await db.select()
    .from(articleBookmarks)
    .where(eq(articleBookmarks.articleId, id))
    .limit(1);

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '该文章未收藏' });
  }

  await db.delete(articleBookmarks).where(eq(articleBookmarks.articleId, id));

  return { success: true };
});
