import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  skillConfigs,
  smDomains, smTopics, smPoints, smTeachings, smChats, smTasks, smNotes, smPointArticles,
  smStages, smStagePoints, smActivities,
} from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的 id' });
  }

  const db = useDB();

  const [row] = await db.select().from(skillConfigs)
    .where(eq(skillConfigs.id, id)).limit(1);
  if (!row) {
    throw createError({ statusCode: 404, message: '技能配置不存在' });
  }

  const sid = row.skillId;

  // Cascade delete all related sm_* data in a transaction
  db.transaction((tx) => {
    // Activities (root-level, by skillId)
    tx.delete(smActivities).where(eq(smActivities.skillId, sid)).run();

    // Stages and stage-point mappings (by skillId)
    const stages = tx.select({ id: smStages.id }).from(smStages)
      .where(eq(smStages.skillId, sid)).all();
    for (const stage of stages) {
      tx.delete(smStagePoints).where(eq(smStagePoints.stageId, stage.id)).run();
    }
    tx.delete(smStages).where(eq(smStages.skillId, sid)).run();

    // Domains → Topics → Points → child tables (teachings, chats, tasks, notes, point_articles)
    const domains = tx.select({ id: smDomains.id }).from(smDomains)
      .where(eq(smDomains.skillId, sid)).all();

    for (const domain of domains) {
      const topics = tx.select({ id: smTopics.id }).from(smTopics)
        .where(eq(smTopics.domainId, domain.id)).all();

      for (const topic of topics) {
        const points = tx.select({ id: smPoints.id }).from(smPoints)
          .where(eq(smPoints.topicId, topic.id)).all();

        for (const point of points) {
          tx.delete(smPointArticles).where(eq(smPointArticles.pointId, point.id)).run();
          tx.delete(smNotes).where(eq(smNotes.pointId, point.id)).run();
          tx.delete(smTasks).where(eq(smTasks.pointId, point.id)).run();
          tx.delete(smChats).where(eq(smChats.pointId, point.id)).run();
          tx.delete(smTeachings).where(eq(smTeachings.pointId, point.id)).run();
        }

        tx.delete(smPoints).where(eq(smPoints.topicId, topic.id)).run();
      }

      tx.delete(smTopics).where(eq(smTopics.domainId, domain.id)).run();
    }

    tx.delete(smDomains).where(eq(smDomains.skillId, sid)).run();

    // Finally delete the config itself
    tx.delete(skillConfigs).where(eq(skillConfigs.id, id)).run();
  });

  return { success: true };
});
