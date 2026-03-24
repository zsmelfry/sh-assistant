import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { milestones, milestoneCompletions, skills } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const skillId = requireNumericParam(event, 'skillId', '技能');
  const db = useDB(event);

  await requireEntity(db, skills, skillId, '技能');

  const rows = await db
    .select({
      id: milestones.id,
      tier: milestones.tier,
      title: milestones.title,
      description: milestones.description,
      milestoneType: milestones.milestoneType,
      verifyMethod: milestones.verifyMethod,
      verifyConfig: milestones.verifyConfig,
      sortOrder: milestones.sortOrder,
      createdAt: milestones.createdAt,
      completionId: milestoneCompletions.id,
      completionVerifyMethod: milestoneCompletions.verifyMethod,
      evidenceUrl: milestoneCompletions.evidenceUrl,
      evidenceNote: milestoneCompletions.evidenceNote,
      verifiedAt: milestoneCompletions.verifiedAt,
    })
    .from(milestones)
    .leftJoin(milestoneCompletions, eq(milestoneCompletions.milestoneId, milestones.id))
    .where(eq(milestones.skillId, skillId))
    .orderBy(milestones.tier, milestones.sortOrder);

  return rows.map((m) => ({
    id: m.id,
    tier: m.tier,
    title: m.title,
    description: m.description,
    milestoneType: m.milestoneType,
    verifyMethod: m.verifyMethod,
    verifyConfig: m.verifyConfig ? JSON.parse(m.verifyConfig) : null,
    sortOrder: m.sortOrder,
    createdAt: m.createdAt,
    completion: m.completionId
      ? {
          id: m.completionId,
          verifyMethod: m.completionVerifyMethod,
          evidenceUrl: m.evidenceUrl,
          evidenceNote: m.evidenceNote,
          verifiedAt: m.verifiedAt,
        }
      : null,
  }));
});
