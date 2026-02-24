import { eq, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  skillConfigs,
  smDomains,
  smTopics,
  smPoints,
  smTeachings,
  smNotes,
  smStages,
  smStagePoints,
} from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '技能配置');
  const query = getQuery(event);
  const includeTeaching = query.includeTeaching === '1';
  const includeNotes = query.includeNotes === '1';

  const db = useDB();

  // Fetch skill config
  const [config] = await db.select().from(skillConfigs)
    .where(eq(skillConfigs.id, id)).limit(1);

  if (!config) {
    throw createError({ statusCode: 404, message: '技能配置不存在' });
  }

  const skillId = config.skillId;

  // Fetch domains
  const domains = await db.select().from(smDomains)
    .where(eq(smDomains.skillId, skillId))
    .orderBy(asc(smDomains.sortOrder));

  // Build tree
  const exportDomains = [];
  for (const domain of domains) {
    const topics = await db.select().from(smTopics)
      .where(eq(smTopics.domainId, domain.id))
      .orderBy(asc(smTopics.sortOrder));

    const exportTopics = [];
    for (const topic of topics) {
      const points = await db.select().from(smPoints)
        .where(eq(smPoints.topicId, topic.id))
        .orderBy(asc(smPoints.sortOrder));

      const exportPoints = [];
      for (const point of points) {
        const exportPoint: Record<string, any> = {
          name: point.name,
          description: point.description,
          sortOrder: point.sortOrder,
          status: point.status,
        };

        if (includeTeaching) {
          const [teaching] = await db.select().from(smTeachings)
            .where(eq(smTeachings.pointId, point.id)).limit(1);
          exportPoint.teaching = teaching
            ? { what: teaching.what, how: teaching.how, example: teaching.example, apply: teaching.apply, resources: teaching.resources }
            : null;
        }

        if (includeNotes) {
          const [note] = await db.select().from(smNotes)
            .where(eq(smNotes.pointId, point.id)).limit(1);
          exportPoint.note = note ? note.content : null;
        }

        exportPoints.push(exportPoint);
      }

      exportTopics.push({
        name: topic.name,
        description: topic.description,
        sortOrder: topic.sortOrder,
        points: exportPoints,
      });
    }

    exportDomains.push({
      name: domain.name,
      description: domain.description,
      sortOrder: domain.sortOrder,
      topics: exportTopics,
    });
  }

  // Fetch stages
  const stages = await db.select().from(smStages)
    .where(eq(smStages.skillId, skillId))
    .orderBy(asc(smStages.sortOrder));

  const exportStages = [];
  for (const stage of stages) {
    const stagePointRows = await db.select({ name: smPoints.name })
      .from(smStagePoints)
      .innerJoin(smPoints, eq(smStagePoints.pointId, smPoints.id))
      .where(eq(smStagePoints.stageId, stage.id))
      .orderBy(asc(smStagePoints.sortOrder));

    exportStages.push({
      name: stage.name,
      description: stage.description || '',
      objective: stage.objective || '',
      pointNames: stagePointRows.map((r) => r.name),
    });
  }

  // Set download headers
  setResponseHeader(event, 'Content-Type', 'application/json');
  setResponseHeader(event, 'Content-Disposition', `attachment; filename=${skillId}-export.json`);

  return {
    version: 1,
    exportedAt: Date.now(),
    config: {
      name: config.name,
      description: config.description,
      icon: config.icon,
      skillId: config.skillId,
      teachingSystemPrompt: config.teachingSystemPrompt,
      teachingUserPrompt: config.teachingUserPrompt,
      chatSystemPrompt: config.chatSystemPrompt,
      taskSystemPrompt: config.taskSystemPrompt,
      taskUserPrompt: config.taskUserPrompt,
    },
    tree: {
      domains: exportDomains,
      stages: exportStages,
    },
  };
});
