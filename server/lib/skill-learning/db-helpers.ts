import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { smPoints, smTopics, smDomains, skillConfigs } from '~/server/database/schema';
import { useDB } from '~/server/database';
import type { SkillConfig, SkillTeachingContext } from './types';
import type { SkillConfigRow } from '~/server/database/schemas/skill-configs';
import { renderTemplate } from './template';
import type { ChatMessage } from '~/server/lib/llm/types';
import {
  POINT_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  TEACHING_SECTIONS,
  TEACHING_SECTION_LABELS,
} from '~/composables/skill-learning/types';

/** Default teaching sections derived from shared constants */
const DEFAULT_TEACHING_SECTIONS: SkillConfig['teachingSections'] =
  TEACHING_SECTIONS.map(key => ({ key, label: TEACHING_SECTION_LABELS[key] }));

/** Build template variables from teaching context and DB row */
function buildTemplateVars(row: SkillConfigRow, ctx: SkillTeachingContext & { teachingSummary?: string }): Record<string, any> {
  return {
    skill: { name: row.name, description: row.description || '' },
    domain: ctx.domain,
    topic: ctx.topic,
    point: ctx.point,
    teachingSummary: ctx.teachingSummary || '',
  };
}

/** Convert a DB row to a SkillConfig object compatible with all existing API handlers */
function buildSkillConfigFromDb(row: SkillConfigRow): SkillConfig {
  return {
    id: row.skillId,
    name: row.name,

    buildTeachingPrompt(ctx: SkillTeachingContext): ChatMessage[] {
      const vars = buildTemplateVars(row, ctx);
      return [
        { role: 'system', content: renderTemplate(row.teachingSystemPrompt, vars) },
        { role: 'user', content: renderTemplate(row.teachingUserPrompt, vars) },
      ];
    },

    buildChatSystemMessage(ctx: SkillTeachingContext & { teachingSummary: string }): ChatMessage {
      const vars = buildTemplateVars(row, ctx);
      return { role: 'system', content: renderTemplate(row.chatSystemPrompt, vars) };
    },

    buildTaskPrompt(ctx: SkillTeachingContext): ChatMessage[] {
      const vars = buildTemplateVars(row, ctx);
      return [
        { role: 'system', content: renderTemplate(row.taskSystemPrompt, vars) },
        { role: 'user', content: renderTemplate(row.taskUserPrompt, vars) },
      ];
    },

    teachingSections: DEFAULT_TEACHING_SECTIONS,
    statusLabels: POINT_STATUS_LABELS,
    activityTypeLabels: ACTIVITY_TYPE_LABELS,
  };
}

/** Extract skillId from route param, query DB, and return config */
export async function resolveSkill(event: H3Event): Promise<{ skillId: string; config: SkillConfig }> {
  const skillId = getRouterParam(event, 'skillId');
  if (!skillId) {
    throw createError({ statusCode: 400, message: '缺少 skillId' });
  }

  const db = useDB();
  const [row] = await db.select().from(skillConfigs)
    .where(eq(skillConfigs.skillId, skillId))
    .limit(1);

  if (!row) {
    throw createError({ statusCode: 404, message: `技能 '${skillId}' 不存在` });
  }

  const config = buildSkillConfigFromDb(row);
  return { skillId, config };
}

/** Verify a knowledge point belongs to the specified skill via point → topic → domain.skillId chain */
export async function requirePointForSkill(
  db: ReturnType<typeof useDB>,
  pointId: number,
  skillId: string,
): Promise<{ point: typeof smPoints.$inferSelect; topic: typeof smTopics.$inferSelect; domain: typeof smDomains.$inferSelect }> {
  const [point] = await db.select().from(smPoints).where(eq(smPoints.id, pointId)).limit(1);
  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  const [topic] = await db.select().from(smTopics).where(eq(smTopics.id, point.topicId)).limit(1);
  const [domain] = topic
    ? await db.select().from(smDomains).where(eq(smDomains.id, topic.domainId)).limit(1)
    : [undefined];

  if (!topic || !domain) {
    throw createError({ statusCode: 500, message: '数据不完整' });
  }

  if (domain.skillId !== skillId) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  return { point, topic, domain };
}
