import { eq, isNull, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { milestones, milestoneCompletions, skills, abilityCategories } from '~/server/database/schema';
import { verifyPlatformAuto } from '~/server/lib/ability/verify';

export default defineEventHandler(async () => {
  const db = useDB();

  // Get all uncompleted milestones that support auto verification
  const rows = await db
    .select({
      milestoneId: milestones.id,
      title: milestones.title,
      tier: milestones.tier,
      verifyMethod: milestones.verifyMethod,
      verifyConfig: milestones.verifyConfig,
      skillId: milestones.skillId,
      skillName: skills.name,
      categoryName: abilityCategories.name,
    })
    .from(milestones)
    .innerJoin(skills, eq(skills.id, milestones.skillId))
    .leftJoin(abilityCategories, eq(abilityCategories.id, skills.categoryId))
    .leftJoin(milestoneCompletions, eq(milestoneCompletions.milestoneId, milestones.id))
    .where(isNull(milestoneCompletions.id))
    .orderBy(milestones.skillId, milestones.tier, milestones.sortOrder);

  const claimable = [];

  for (const row of rows) {
    // Only check milestones with platform_auto verify method and a config
    if (row.verifyMethod !== 'platform_auto' || !row.verifyConfig) continue;

    try {
      const config = JSON.parse(row.verifyConfig);
      const result = await verifyPlatformAuto(db, config);

      if (result.passed) {
        claimable.push({
          milestoneId: row.milestoneId,
          title: row.title,
          tier: row.tier,
          skillId: row.skillId,
          skillName: row.skillName,
          categoryName: row.categoryName,
          currentValue: result.score,
          threshold: config.threshold,
          detail: result.detail,
        });
      }
    } catch {
      // Skip milestones with invalid config
    }
  }

  return claimable;
});
