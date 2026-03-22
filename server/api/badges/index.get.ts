import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { badges, badgeAwards } from '~/server/database/schema';
import { BADGE_SEED } from '~/server/database/seeds/badges';

export default defineEventHandler(async (event) => {
  const db = useDB(event);

  // Auto-seed badges if empty
  let allBadges = await db.select().from(badges);
  if (allBadges.length === 0) {
    const now = Date.now();
    await db.insert(badges).values(
      BADGE_SEED.map((b) => ({
        key: b.key,
        name: b.name,
        description: b.description,
        rarity: b.rarity,
        createdAt: now,
      })),
    );
    allBadges = await db.select().from(badges);
  }

  // Get awarded badges
  const awards = await db.select().from(badgeAwards);
  const awardedMap = new Map(awards.map((a) => [a.badgeId, a]));

  return allBadges.map((b) => {
    const award = awardedMap.get(b.id);
    return {
      ...b,
      awarded: !!award,
      awardedAt: award?.awardedAt || null,
    };
  });
});
