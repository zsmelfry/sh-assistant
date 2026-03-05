import { useDB } from '~/server/database';
import { songs } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.title?.trim() || !body.artist?.trim()) {
    throw createError({ statusCode: 400, message: '请提供歌曲名称和歌手' });
  }

  const db = useDB();
  const now = Date.now();

  const [song] = db.insert(songs).values({
    title: body.title.trim(),
    artist: body.artist.trim(),
    album: body.album?.trim() || null,
    year: body.year ? Number(body.year) : null,
    genre: body.genre?.trim() || null,
    lyrics: body.lyrics?.trim() || null,
    notes: body.notes?.trim() || null,
    youtubeUrl: body.youtubeUrl?.trim() || null,
    createdAt: now,
    updatedAt: now,
  }).returning().all();

  return song;
});
