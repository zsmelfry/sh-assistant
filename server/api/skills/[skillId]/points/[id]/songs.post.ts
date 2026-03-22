import { useDB } from '~/server/database';
import { smPointSongs } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { skillId } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  if (!Array.isArray(body.songIds) || body.songIds.length === 0) {
    throw createError({ statusCode: 400, message: '缺少 songIds 数组' });
  }
  await requirePointForSkill(db, id, skillId);

  const now = Date.now();
  const inserted = db.transaction((tx) => {
    const results = [];
    for (const songId of body.songIds) {
      try {
        const [row] = tx.insert(smPointSongs)
          .values({ pointId: id, songId: Number(songId), createdAt: now })
          .returning().all();
        results.push(row);
      } catch {
        // Skip duplicates (composite PK conflict)
      }
    }
    return results;
  });

  return { inserted: inserted.length };
});
