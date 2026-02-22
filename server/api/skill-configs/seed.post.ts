import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skillConfigs } from '~/server/database/schema';
import { STARTUP_MAP_CONFIG_SEED } from '~/server/database/seeds/startup-map-config';

export default defineEventHandler(async () => {
  const db = useDB();
  const created: string[] = [];

  const seeds = [STARTUP_MAP_CONFIG_SEED];

  for (const seed of seeds) {
    const [existing] = await db.select().from(skillConfigs)
      .where(eq(skillConfigs.skillId, seed.skillId)).limit(1);

    if (!existing) {
      const now = Date.now();
      await db.insert(skillConfigs).values({
        skillId: seed.skillId,
        name: seed.name,
        description: seed.description,
        icon: seed.icon,
        teachingSystemPrompt: seed.teachingSystemPrompt,
        teachingUserPrompt: seed.teachingUserPrompt,
        chatSystemPrompt: seed.chatSystemPrompt,
        taskSystemPrompt: seed.taskSystemPrompt,
        taskUserPrompt: seed.taskUserPrompt,
        sortOrder: seed.sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      created.push(seed.skillId);
    }
  }

  return { success: true, created };
});
