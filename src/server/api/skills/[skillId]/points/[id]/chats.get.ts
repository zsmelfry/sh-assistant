import { eq, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smChats } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '知识点');

  await requirePointForSkill(db, id, skillId);

  return db.select()
    .from(smChats)
    .where(eq(smChats.pointId, id))
    .orderBy(asc(smChats.createdAt));
});
