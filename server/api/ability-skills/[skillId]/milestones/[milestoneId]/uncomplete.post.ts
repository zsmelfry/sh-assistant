import { eq, and, gt } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills, milestones, milestoneCompletions, TIER_NAMES } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { logActivity } from '~/server/lib/ability/log-activity';
import { checkBadgesOnSkillChange } from '~/server/lib/ability/badge-check';

export default defineEventHandler(async (event) => {
  const skillId = requireNumericParam(event, 'skillId', '技能');
  const id = requireNumericParam(event, 'milestoneId', '里程碑');
  const db = useDB();

  // Validate skill exists
  const [skill] = await db.select().from(skills).where(eq(skills.id, skillId));
  if (!skill) {
    throw createError({ statusCode: 404, message: '技能不存在' });
  }

  // Validate milestone exists and belongs to skill
  const [milestone] = await db.select().from(milestones)
    .where(and(eq(milestones.id, id), eq(milestones.skillId, skillId)));
  if (!milestone) {
    throw createError({ statusCode: 404, message: '里程碑不存在' });
  }

  // Check milestone is actually completed
  const [completion] = await db.select().from(milestoneCompletions)
    .where(eq(milestoneCompletions.milestoneId, id));
  if (!completion) {
    throw createError({ statusCode: 400, message: '里程碑尚未完成，无法回滚' });
  }

  // Check no higher-tier milestones are completed (can't skip tiers)
  const higherTierMilestones = await db.select({ id: milestones.id })
    .from(milestones)
    .where(and(eq(milestones.skillId, skillId), gt(milestones.tier, milestone.tier)));

  if (higherTierMilestones.length > 0) {
    for (const hm of higherTierMilestones) {
      const [comp] = await db.select({ id: milestoneCompletions.id })
        .from(milestoneCompletions)
        .where(eq(milestoneCompletions.milestoneId, hm.id))
        .limit(1);
      if (comp) {
        throw createError({
          statusCode: 400,
          message: '存在更高段位的已完成里程碑，请先回滚更高段位的里程碑',
        });
      }
    }
  }

  // Delete the completion record
  await db.delete(milestoneCompletions).where(eq(milestoneCompletions.milestoneId, id));

  // Check if we need to downgrade currentTier
  // currentTier should be the highest tier where ALL milestones are complete
  let newTier = 0;
  for (let tier = 1; tier <= 5; tier++) {
    const tierMilestones = await db.select({ id: milestones.id })
      .from(milestones)
      .where(and(eq(milestones.skillId, skillId), eq(milestones.tier, tier)));

    if (tierMilestones.length === 0) break;

    let allComplete = true;
    for (const tm of tierMilestones) {
      const [comp] = await db.select({ id: milestoneCompletions.id })
        .from(milestoneCompletions)
        .where(eq(milestoneCompletions.milestoneId, tm.id))
        .limit(1);
      if (!comp) {
        allComplete = false;
        break;
      }
    }

    if (allComplete) {
      newTier = tier;
    } else {
      break;
    }
  }

  if (newTier !== skill.currentTier) {
    await db.update(skills).set({
      currentTier: newTier,
      updatedAt: Date.now(),
    }).where(eq(skills.id, skillId));
  }

  // Log activity
  await logActivity({
    skillId,
    categoryId: skill.categoryId,
    source: 'milestone',
    sourceRef: String(id),
    description: `回滚里程碑：${milestone.title}`,
  });

  // Re-check badges (may need revocation)
  checkBadgesOnSkillChange(db, 'delete').catch(() => {});

  return {
    success: true,
    newTier,
    previousTier: skill.currentTier,
  };
});
