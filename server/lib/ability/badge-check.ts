import { eq, sql } from 'drizzle-orm';
import { badges, badgeAwards, skills, milestoneCompletions, abilityCategories } from '~/server/database/schema';

type DB = ReturnType<typeof import('~/server/database').useDB>;

interface BadgeCheckResult {
  badgeKey: string;
  badgeName: string;
  awarded: boolean;
}

/**
 * Check and award badges based on current state.
 * Called after milestone completion or tier unlock.
 */
export async function checkAndAwardBadges(
  db: DB,
  skillId: number,
  newTier?: number,
): Promise<BadgeCheckResult[]> {
  const results: BadgeCheckResult[] = [];

  // Ensure badges are seeded
  const allBadges = await db.select().from(badges);
  if (allBadges.length === 0) return results;

  const awardedBadges = await db.select().from(badgeAwards);
  const awardedKeys = new Set(
    awardedBadges.map((a) => {
      const badge = allBadges.find((b) => b.id === a.badgeId);
      return badge?.key;
    }).filter(Boolean),
  );

  const now = Date.now();

  // Check: first_milestone — completed at least 1 milestone
  if (!awardedKeys.has('first_milestone')) {
    const [count] = await db
      .select({ count: sql<number>`count(*)` })
      .from(milestoneCompletions);
    if (count.count >= 1) {
      const awarded = await awardBadge(db, allBadges, 'first_milestone', skillId, now);
      if (awarded) results.push(awarded);
    }
  }

  // Check: first_tier — any skill reached tier 1+
  if (!awardedKeys.has('first_tier') && newTier && newTier >= 1) {
    const awarded = await awardBadge(db, allBadges, 'first_tier', skillId, now);
    if (awarded) results.push(awarded);
  }

  // Check: deep_mastery — any skill reached tier 5
  if (!awardedKeys.has('deep_mastery') && newTier === 5) {
    const awarded = await awardBadge(db, allBadges, 'deep_mastery', skillId, now);
    if (awarded) results.push(awarded);
  }

  // Check: lifelong_learner — 3+ active skills
  if (!awardedKeys.has('lifelong_learner')) {
    const [count] = await db
      .select({ count: sql<number>`count(*)` })
      .from(skills)
      .where(eq(skills.status, 'active'));
    if (count.count >= 3) {
      const awarded = await awardBadge(db, allBadges, 'lifelong_learner', skillId, now);
      if (awarded) results.push(awarded);
    }
  }

  // Check: polymath — skills in 5+ categories at tier 2+
  if (!awardedKeys.has('polymath')) {
    const categoriesWithBasic = await db
      .select({ categoryId: skills.categoryId })
      .from(skills)
      .where(sql`${skills.currentTier} >= 2 AND ${skills.status} = 'active'`)
      .groupBy(skills.categoryId);
    if (categoriesWithBasic.length >= 5) {
      const awarded = await awardBadge(db, allBadges, 'polymath', skillId, now);
      if (awarded) results.push(awarded);
    }
  }

  return results;
}

async function awardBadge(
  db: DB,
  allBadges: Array<{ id: number; key: string; name: string }>,
  badgeKey: string,
  skillId: number,
  now: number,
): Promise<BadgeCheckResult | null> {
  const badge = allBadges.find((b) => b.key === badgeKey);
  if (!badge) return null;

  // Double-check not already awarded
  const [existing] = await db.select().from(badgeAwards)
    .where(eq(badgeAwards.badgeId, badge.id));
  if (existing) return null;

  await db.insert(badgeAwards).values({
    badgeId: badge.id,
    skillId,
    awardedAt: now,
    createdAt: now,
  });

  return { badgeKey, badgeName: badge.name, awarded: true };
}
