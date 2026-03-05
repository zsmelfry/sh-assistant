import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { songs } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的歌曲 ID' });
  }

  const db = useDB();
  const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);

  if (!song) {
    throw createError({ statusCode: 404, message: '歌曲不存在' });
  }

  return song;
});
