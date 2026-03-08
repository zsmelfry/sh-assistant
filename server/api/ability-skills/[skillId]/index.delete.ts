import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';
import { checkBadgesOnSkillChange } from '~/server/lib/ability/badge-check';

export default defineEventHandler(async (event) => {
  const skillId = requireNumericParam(event, 'skillId', '技能');
  const db = useDB();

  await requireEntity(db, skills, skillId, '技能');
  await db.delete(skills).where(eq(skills.id, skillId));

  // Re-validate badges after skill deletion (may mark some as historical)
  checkBadgesOnSkillChange(db, 'delete').catch(() => {});

  return { success: true };
});
