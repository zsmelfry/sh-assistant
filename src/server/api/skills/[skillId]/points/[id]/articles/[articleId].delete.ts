import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointArticles } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId } = await resolveSkill(db, event);
  const pointId = requireNumericParam(event, 'id', '知识点');
  const articleId = requireNumericParam(event, 'articleId', '文章');

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
