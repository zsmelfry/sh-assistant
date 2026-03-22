import { eq, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smTasks } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { skillId } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '知识点');

  await requirePointForSkill(db, id, skillId);

  return db.select()
    .from(smTasks)
    .where(eq(smTasks.pointId, id))
    .orderBy(asc(smTasks.sortOrder));
});
