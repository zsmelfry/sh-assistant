import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointArticles } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { skillId } = await resolveSkill(db, event);
  const articleId = requireNumericParam(event, 'articleId', '文章');
  const pointId = requireNumericParam(event, 'pointId', '知识点');

  // Verify point belongs to this skill
  await requirePointForSkill(db, pointId, skillId);

  const result = await db.delete(smPointArticles)
    .where(and(
      eq(smPointArticles.pointId, pointId),
      eq(smPointArticles.articleId, articleId),
    ))
    .returning();

  if (result.length === 0) {
    throw createError({ statusCode: 404, message: '关联不存在' });
  }

  return { success: true };
});
