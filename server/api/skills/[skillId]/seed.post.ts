import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smDomains, smTopics, smPoints, smStages, smStagePoints } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';
import type { SeedDomain, SeedStage } from '~/server/database/seeds/startup-map';

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const db = useDB();

  // Idempotent: skip if data already exists for this skill
  const existing = await db.select().from(smDomains).where(eq(smDomains.skillId, skillId)).limit(1);
  if (existing.length > 0) {
    return { success: true, message: 'Seed data already exists', skipped: true };
  }

  const body = await readBody(event);
  const seedDomains: SeedDomain[] | undefined = body?.domains;
  const seedStages: SeedStage[] | undefined = body?.stages;

  if (!seedDomains || !Array.isArray(seedDomains) || seedDomains.length === 0) {
    throw createError({ statusCode: 400, message: '请提供 domains 数据' });
  }
  if (!seedStages || !Array.isArray(seedStages)) {
    throw createError({ statusCode: 400, message: '请提供 stages 数据' });
  }

  const now = Date.now();
  let totalTopics = 0;
  let totalPoints = 0;

  const pointNameToId = new Map<string, number>();

  db.transaction((tx) => {
    for (let di = 0; di < seedDomains.length; di++) {
      const domain = seedDomains[di];

      const [insertedDomain] = tx.insert(smDomains).values({
        name: domain.name,
        description: domain.description,
        sortOrder: di,
        skillId,
        createdAt: now,
      }).returning().all();

      for (let ti = 0; ti < domain.topics.length; ti++) {
        const topic = domain.topics[ti];
        totalTopics++;

        const [insertedTopic] = tx.insert(smTopics).values({
          domainId: insertedDomain.id,
          name: topic.name,
          description: topic.description,
          sortOrder: ti,
          createdAt: now,
        }).returning().all();

        for (let pi = 0; pi < topic.points.length; pi++) {
          const point = topic.points[pi];
          totalPoints++;

          const [insertedPoint] = tx.insert(smPoints).values({
            topicId: insertedTopic.id,
            name: point.name,
            description: point.description,
            status: 'not_started',
            sortOrder: pi,
            createdAt: now,
          }).returning().all();

          pointNameToId.set(point.name, insertedPoint.id);
        }
      }
    }

    for (let si = 0; si < seedStages.length; si++) {
      const stage = seedStages[si];

      const [insertedStage] = tx.insert(smStages).values({
        name: stage.name,
        description: stage.description,
        objective: stage.objective,
        sortOrder: si,
        skillId,
      }).returning().all();

      for (let pi = 0; pi < stage.pointNames.length; pi++) {
        const pointId = pointNameToId.get(stage.pointNames[pi]);
        if (pointId) {
          tx.insert(smStagePoints).values({
            stageId: insertedStage.id,
            pointId,
            sortOrder: pi,
          }).run();
        }
      }
    }
  });

  return {
    success: true,
    counts: {
      domains: seedDomains.length,
      topics: totalTopics,
      points: totalPoints,
      stages: seedStages.length,
    },
  };
});
