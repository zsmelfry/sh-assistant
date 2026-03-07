import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { milestones, milestoneCompletions } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const skillId = requireNumericParam(event, 'skillId', '技能');
  const id = requireNumericParam(event, 'id', '里程碑');
  const db = useDB();

  const [milestone] = await db.select().from(milestones)
    .where(and(eq(milestones.id, id), eq(milestones.skillId, skillId)));
  if (!milestone) {
    throw createError({ statusCode: 404, message: '里程碑不存在' });
  }

  // Check if already completed — don't allow deleting completed milestones
  const [completion] = await db.select().from(milestoneCompletions)
    .where(eq(milestoneCompletions.milestoneId, id));
  if (completion) {
    throw createError({ statusCode: 400, message: '已完成的里程碑不能删除' });
  }

  await db.delete(milestones).where(eq(milestones.id, id));
  return { success: true };
});
