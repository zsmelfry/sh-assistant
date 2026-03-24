import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointSongs, songs } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '知识点');

  await requirePointForSkill(db, id, skillId);

  const rows = await db
    .select({
      songId: songs.id,
      title: songs.title,
      artist: songs.artist,
      year: songs.year,
      youtubeUrl: songs.youtubeUrl,
      notes: songs.notes,
      sheetMusic: songs.sheetMusic,
      linkedAt: smPointSongs.createdAt,
    })
    .from(smPointSongs)
    .innerJoin(songs, sql`${songs.id} = ${smPointSongs.songId}`)
    .where(eq(smPointSongs.pointId, id));

  return rows.map(r => ({
    songId: r.songId,
    title: r.title,
    artist: r.artist,
    year: r.year,
    youtubeUrl: r.youtubeUrl,
    melody: r.notes ? JSON.parse(r.notes) : null,
    sheetMusic: r.sheetMusic || null,
    linkedAt: r.linkedAt,
  }));
});
