import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills, milestones, milestoneCompletions, activityLogs, TIER_NAMES } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { checkAndAwardBadges } from '~/server/lib/ability/badge-check';
import { logActivity } from '~/server/lib/ability/log-activity';

export default defineEventHandler(async (event) => {
  const skillId = requireNumericParam(event, 'skillId', '技能');
  const id = requireNumericParam(event, 'id', '里程碑');
  const body = await readBody(event);
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

  // Check not already completed
  const [existing] = await db.select().from(milestoneCompletions)
    .where(eq(milestoneCompletions.milestoneId, id));
  if (existing) {
    throw createError({ statusCode: 400, message: '里程碑已完成' });
  }

  // Determine verify method — use the one from body or fallback to milestone's default
  const verifyMethod = body.verifyMethod || milestone.verifyMethod;
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Create completion record
  const [completion] = await db.insert(milestoneCompletions).values({
    milestoneId: id,
    verifyMethod,
    evidenceUrl: body.evidenceUrl || null,
    evidenceNote: body.evidenceNote || null,
    verifiedAt: now,
    createdAt: now,
  }).returning();

  // Log activity
  await logActivity({
    skillId,
    categoryId: skill.categoryId,
    source: 'milestone',
    sourceRef: String(id),
    description: `完成里程碑：${milestone.title}`,
    date: today,
  });

  // Check tier unlock: are all milestones in the next tier completed?
  const tierUnlocked = await checkTierUnlock(db, skillId, skill);

  // Check badge awards
  const awardedBadges = await checkAndAwardBadges(
    db, skillId, tierUnlocked?.newTier,
  );

  return {
    completion,
    tierUnlocked,
    awardedBadges,
  };
});

async function checkTierUnlock(
  db: ReturnType<typeof useDB>,
  skillId: number,
  skill: { currentTier: number },
): Promise<{ unlocked: boolean; newTier: number } | null> {
  const nextTier = skill.currentTier + 1;
  if (nextTier > 5) return null;

  // Get all milestones for the next tier
  const tierMilestones = await db.select({
    id: milestones.id,
    completionId: milestoneCompletions.id,
  })
    .from(milestones)
    .leftJoin(milestoneCompletions, eq(milestoneCompletions.milestoneId, milestones.id))
    .where(and(eq(milestones.skillId, skillId), eq(milestones.tier, nextTier)));

  if (tierMilestones.length === 0) return null;

  const allCompleted = tierMilestones.every((m) => m.completionId !== null);
  if (!allCompleted) return null;

  // Unlock tier
  await db.update(skills).set({
    currentTier: nextTier,
    updatedAt: Date.now(),
  }).where(eq(skills.id, skillId));

  await logActivity({
    skillId,
    categoryId: skill.categoryId,
    source: 'milestone',
    description: `段位解锁：${TIER_NAMES[nextTier]}`,
  });

  return { unlocked: true, newTier: nextTier };
}
