import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { songs } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的歌曲 ID' });
  }

  const body = await readBody(event);
  const db = useDB();

  const [existing] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!existing) {
    throw createError({ statusCode: 404, message: '歌曲不存在' });
  }

  const updates: Record<string, any> = { updatedAt: Date.now() };
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.artist !== undefined) updates.artist = body.artist.trim();
  if (body.album !== undefined) updates.album = body.album?.trim() || null;
  if (body.year !== undefined) updates.year = body.year ? Number(body.year) : null;
  if (body.genre !== undefined) updates.genre = body.genre?.trim() || null;
  if (body.lyrics !== undefined) updates.lyrics = body.lyrics?.trim() || null;
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
  if (body.sheetMusic !== undefined) updates.sheetMusic = body.sheetMusic?.trim() || null;
  if (body.youtubeUrl !== undefined) updates.youtubeUrl = body.youtubeUrl?.trim() || null;

  const [updated] = db.update(songs).set(updates).where(eq(songs.id, id)).returning().all();
  return updated;
});
