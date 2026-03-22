import { and, eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointSongs } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '知识点');
  const songId = Number(getRouterParam(event, 'songId'));

  if (!songId || isNaN(songId)) {
    throw createError({ statusCode: 400, message: '无效的歌曲 ID' });
  }
  await requirePointForSkill(db, id, skillId);

  db.delete(smPointSongs)
    .where(and(eq(smPointSongs.pointId, id), eq(smPointSongs.songId, songId)))
    .run();

  return { success: true };
});
