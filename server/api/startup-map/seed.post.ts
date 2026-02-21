import { useDB } from '~/server/database';
import { smDomains, smTopics, smPoints } from '~/server/database/schema';
import { SEED_DOMAINS } from '~/server/database/seeds/startup-map';

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

  db.transaction((tx) => {
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

          tx.insert(smPoints).values({
            topicId: insertedTopic.id,
            name: point.name,
            description: point.description,
            status: 'not_started',
            sortOrder: pi,
            createdAt: now,
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
    },
  };
});
