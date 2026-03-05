import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { songs } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的歌曲 ID' });
  }

  const db = useDB();
  const deleted = db.delete(songs).where(eq(songs.id, id)).returning().all();

  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: '歌曲不存在' });
  }

  return { success: true };
});
