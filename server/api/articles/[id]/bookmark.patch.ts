import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articleBookmarks } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的文章 ID' });
  }

  const body = await readBody(event);

  if (body.notes === undefined) {
    throw createError({ statusCode: 400, message: '需要提供 notes 字段' });
  }

  const db = useDB();

  const existing = await db.select()
    .from(articleBookmarks)
    .where(eq(articleBookmarks.articleId, id))
    .limit(1);

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '该文章未收藏' });
  }

  const result = await db.update(articleBookmarks)
    .set({ notes: body.notes })
    .where(eq(articleBookmarks.articleId, id))
    .returning();

  return result[0];
});
