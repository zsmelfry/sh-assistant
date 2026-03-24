import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills, milestones, milestoneCompletions, skillCurrentState, abilityCategories } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'skillId', '技能');
  const db = useDB(event);

  // Fetch skill with category name
  const [skill] = await db
    .select({
      id: skills.id,
      categoryId: skills.categoryId,
      categoryName: abilityCategories.name,
      name: skills.name,
      description: skills.description,
      icon: skills.icon,
      source: skills.source,
      templateId: skills.templateId,
      currentTier: skills.currentTier,
      status: skills.status,
      sortOrder: skills.sortOrder,
      createdAt: skills.createdAt,
      updatedAt: skills.updatedAt,
    })
    .from(skills)
    .leftJoin(abilityCategories, eq(abilityCategories.id, skills.categoryId))
    .where(eq(skills.id, id));

  if (!skill) {
    throw createError({ statusCode: 404, message: '技能不存在' });
  }

  // Fetch milestones with completion status
  const milestoneRows = await db
    .select({
      id: milestones.id,
      tier: milestones.tier,
      title: milestones.title,
      description: milestones.description,
      milestoneType: milestones.milestoneType,
      verifyMethod: milestones.verifyMethod,
      verifyConfig: milestones.verifyConfig,
      sortOrder: milestones.sortOrder,
      completionId: milestoneCompletions.id,
      completionVerifyMethod: milestoneCompletions.verifyMethod,
      evidenceUrl: milestoneCompletions.evidenceUrl,
      evidenceNote: milestoneCompletions.evidenceNote,
      verifiedAt: milestoneCompletions.verifiedAt,
    })
    .from(milestones)
    .leftJoin(milestoneCompletions, eq(milestoneCompletions.milestoneId, milestones.id))
    .where(eq(milestones.skillId, id))
    .orderBy(milestones.tier, milestones.sortOrder);

  // Fetch current states
  const states = await db
    .select()
    .from(skillCurrentState)
    .where(eq(skillCurrentState.skillId, id));

  // Group milestones by tier
  const milestonesByTier: Record<number, typeof milestoneRows> = {};
  for (const m of milestoneRows) {
    if (!milestonesByTier[m.tier]) milestonesByTier[m.tier] = [];
    milestonesByTier[m.tier].push(m);
  }

  return {
    ...skill,
    milestones: milestoneRows.map((m) => ({
      id: m.id,
      tier: m.tier,
      title: m.title,
      description: m.description,
      milestoneType: m.milestoneType,
      verifyMethod: m.verifyMethod,
      verifyConfig: m.verifyConfig ? JSON.parse(m.verifyConfig) : null,
      sortOrder: m.sortOrder,
      completion: m.completionId
        ? {
            id: m.completionId,
            verifyMethod: m.completionVerifyMethod,
            evidenceUrl: m.evidenceUrl,
            evidenceNote: m.evidenceNote,
            verifiedAt: m.verifiedAt,
          }
        : null,
    })),
    milestonesByTier,
    currentStates: states,
  };
});
