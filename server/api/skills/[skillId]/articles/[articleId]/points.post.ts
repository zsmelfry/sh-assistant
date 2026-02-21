import { useDB } from '~/server/database';
import { smPointArticles } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const articleId = requireNumericParam(event, 'articleId', '文章');

  const body = await readBody(event);
  if (!Array.isArray(body.pointIds) || body.pointIds.length === 0) {
    throw createError({ statusCode: 400, message: '缺少 pointIds 数组' });
  }

  const db = useDB();

  // Verify each point belongs to this skill
  for (const pointId of body.pointIds) {
    await requirePointForSkill(db, Number(pointId), skillId);
  }

  const now = Date.now();
  const inserted = db.transaction((tx) => {
    const results = [];
    for (const pointId of body.pointIds) {
      try {
        const [row] = tx.insert(smPointArticles)
          .values({ pointId: Number(pointId), articleId, createdAt: now })
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
