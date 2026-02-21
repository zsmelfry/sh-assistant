import { useDB } from '~/server/database';
import { smDomains, smTopics, smPoints, smStages, smStagePoints } from '~/server/database/schema';
import { SEED_DOMAINS, SEED_STAGES } from '~/server/database/seeds/startup-map';

export default defineEventHandler(async () => {
  const db = useDB();

  // Idempotent: skip if data already exists
  const existing = await db.select().from(smDomains).limit(1);
  if (existing.length > 0) {
    return { success: true, message: 'Seed data already exists', skipped: true };
  }

  const now = Date.now();
  let totalTopics = 0;
  let totalPoints = 0;

  // Map point name → inserted ID for stage-point mapping
  const pointNameToId = new Map<string, number>();

  db.transaction((tx) => {
    // Insert domains → topics → points
    for (let di = 0; di < SEED_DOMAINS.length; di++) {
      const domain = SEED_DOMAINS[di];

      const [insertedDomain] = tx.insert(smDomains).values({
        name: domain.name,
        description: domain.description,
        sortOrder: di,
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

    // Insert stages and stage-point mappings
    for (let si = 0; si < SEED_STAGES.length; si++) {
      const stage = SEED_STAGES[si];

      const [insertedStage] = tx.insert(smStages).values({
        name: stage.name,
        description: stage.description,
        objective: stage.objective,
        sortOrder: si,
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
      domains: SEED_DOMAINS.length,
      topics: totalTopics,
      points: totalPoints,
      stages: SEED_STAGES.length,
    },
  };
});
