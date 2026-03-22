import { useDB } from '~/server/database';
import { abilityCategories } from '~/server/database/schema';
import { ABILITY_CATEGORY_SEED } from '~/server/database/seeds/ability-categories';
import { ensureSelfManagementSkills } from '~/server/lib/ability/self-management';

export default defineEventHandler(async () => {
  const db = useDB();

  let rows = await db.select().from(abilityCategories).orderBy(abilityCategories.sortOrder);

  // Auto-seed if empty
  if (rows.length === 0) {
    const now = Date.now();
    await db.insert(abilityCategories).values(
      ABILITY_CATEGORY_SEED.map((c) => ({
        name: c.name,
        description: c.description,
        icon: c.icon,
        sortOrder: c.sortOrder,
        createdAt: now,
      })),
    );
    rows = await db.select().from(abilityCategories).orderBy(abilityCategories.sortOrder);

    // Auto-create self-management skills after first seed
    await ensureSelfManagementSkills(db);
  }

  return rows;
});
