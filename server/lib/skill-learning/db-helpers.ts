import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { smPoints, smTopics, smDomains, skillConfigs } from '~/server/database/schema';
import { useDB } from '~/server/database';
import type { SkillConfig, SkillTeachingContext } from './types';
import type { SkillConfigRow } from '~/server/database/schemas/skill-configs';
import { renderTemplate } from './template';
import type { ChatMessage } from '~/server/lib/llm/types';

/** Default teaching sections shared by all skills */
const DEFAULT_TEACHING_SECTIONS: SkillConfig['teachingSections'] = [
  { key: 'what', label: '是什么' },
  { key: 'how', label: '怎么做' },
  { key: 'example', label: '案例' },
  { key: 'apply', label: '我的应用' },
  { key: 'resources', label: '推荐资源' },
];

/** Default status labels shared by all skills */
const DEFAULT_STATUS_LABELS: SkillConfig['statusLabels'] = {
  not_started: '未开始',
  learning: '学习中',
  understood: '已理解',
  practiced: '已实践',
};

/** Default activity type labels shared by all skills */
const DEFAULT_ACTIVITY_LABELS: SkillConfig['activityTypeLabels'] = {
  view: '查看知识点',
  chat: 'AI 对话',
  note: '编辑笔记',
  task: '完成任务',
  status_change: '状态变更',
};

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
    statusLabels: DEFAULT_STATUS_LABELS,
    activityTypeLabels: DEFAULT_ACTIVITY_LABELS,
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
