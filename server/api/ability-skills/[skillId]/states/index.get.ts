import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skillCurrentState, skills } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const skillId = requireNumericParam(event, 'skillId', '技能');
  const db = useDB();

  await requireEntity(db, skills, skillId, '技能');

  const states = await db.select().from(skillCurrentState)
    .where(eq(skillCurrentState.skillId, skillId));

  return states.map((s) => ({
    ...s,
    isExpired: s.expiresAfterDays > 0 &&
      Date.now() - s.confirmedAt > s.expiresAfterDays * 24 * 60 * 60 * 1000,
  }));
});
