import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointSongs, songs } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const id = requireNumericParam(event, 'id', '知识点');
  const db = useDB();

  await requirePointForSkill(db, id, skillId);

  const rows = await db
    .select({
      songId: songs.id,
      title: songs.title,
      artist: songs.artist,
      year: songs.year,
      youtubeUrl: songs.youtubeUrl,
      notes: songs.notes,
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
    linkedAt: r.linkedAt,
  }));
});
