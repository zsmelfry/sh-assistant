import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { badges, badgeAwards } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();

  const rows = await db
    .select({
      id: badgeAwards.id,
      badgeId: badgeAwards.badgeId,
      badgeKey: badges.key,
      badgeName: badges.name,
      badgeDescription: badges.description,
      badgeRarity: badges.rarity,
      skillId: badgeAwards.skillId,
      awardedAt: badgeAwards.awardedAt,
    })
    .from(badgeAwards)
    .leftJoin(badges, eq(badges.id, badgeAwards.badgeId))
    .orderBy(badgeAwards.awardedAt);

  return rows;
});
