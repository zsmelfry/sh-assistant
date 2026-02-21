import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smTeachings } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const id = requireNumericParam(event, 'id', '知识点');
  const db = useDB();

  const { point, topic, domain } = await requirePointForSkill(db, id, skillId);

  const [teaching] = await db.select()
    .from(smTeachings)
    .where(eq(smTeachings.pointId, id))
    .limit(1);

  return {
    ...point,
    teaching: teaching || null,
    topic: { id: topic.id, name: topic.name },
    domain: { id: domain.id, name: domain.name },
  };
});
