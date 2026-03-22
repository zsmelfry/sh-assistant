import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { smPoints, smTopics, smDomains, skillConfigs } from '~/server/database/schema';
import type { useDB } from '~/server/database';
import {
  POINT_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  TEACHING_SECTION_KEYS,
  TEACHING_SECTION_KEY_LABELS,
} from './types';
import type { SkillConfig, SkillTeachingContext, TeachingSectionKey } from './types';
import type { SkillConfigRow } from '~/server/database/schemas/skill-configs';
import { renderTemplate } from './template';
import type { ChatMessage } from '~/server/lib/llm/types';

/** Default teaching sections derived from shared constants */
const DEFAULT_TEACHING_SECTIONS: SkillConfig['teachingSections'] =
  TEACHING_SECTION_KEYS.map(key => ({ key, label: TEACHING_SECTION_KEY_LABELS[key] }));

const DEFAULT_QUIZ_SYSTEM_PROMPT = `你是一个教育测验出题专家。根据给定的教学内容，生成理解测验题来检测学生是否真正理解了核心概念。

要求：
- 根据内容复杂程度生成 2-5 道题（简单概念2-3道，复杂概念4-5道）
- 题目类型必须多样化，不能全是同一类型。可用类型：multiple_choice（选择题，4个选项）、true_false（判断题）、fill_blank（填空题）
- 题目要考察深层理解，不是简单的记忆复述
- 难度从易到难排列

返回严格的JSON数组格式（不要用markdown代码块包裹）：
[
  {
    "type": "multiple_choice",
    "question": "题目文本",
    "options": ["A选项", "B选项", "C选项", "D选项"],
    "correctAnswer": "正确答案文本",
    "explanation": "为什么这个答案是对的（简短解释）"
  },
  {
    "type": "true_false",
    "question": "判断题文本",
    "options": ["正确", "错误"],
    "correctAnswer": "正确或错误",
    "explanation": "解释"
  }
]
注意：fill_blank类型的options为null。`;

const DEFAULT_QUIZ_USER_PROMPT = `知识点：{{point.name}}
所属领域：{{domain.name}} > {{topic.name}}

教学内容：
{{teachingSummary}}

请针对以上内容生成理解测验题。`;

const DEFAULT_GUIDANCE_SYSTEM_PROMPT = `你是一个善于引导学习的AI导师。学生刚阅读了一个知识点的教学内容。
你需要：
1. 生成1-2个引导性问题，帮助学生深入思考（如"你觉得X和Y有什么区别？"）
2. 生成3-4个快捷问题按钮，每个有label（显示文本,8字以内）和prompt（完整的提问文本）

返回严格的JSON格式（不要用markdown代码块包裹）：
{
  "guidingQuestions": ["问题1", "问题2"],
  "quickButtons": [
    {"label": "举个例子", "prompt": "能给我举一个关于这个知识点的实际例子吗？"},
    {"label": "简单解释", "prompt": "能用更简单的话解释一下吗？"},
    {"label": "应用场景", "prompt": "这个知识点在实际工作中怎么应用？"},
    {"label": "常见误区", "prompt": "学习这个知识点时有哪些常见的误区？"}
  ]
}`;

const DEFAULT_GUIDANCE_USER_PROMPT = `知识点：{{point.name}}
所属领域：{{domain.name}} > {{topic.name}}
描述：{{point.description}}

教学内容摘要：
{{teachingSummary}}

请生成引导性问题和快捷按钮。`;

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

    buildQuizPrompt(ctx: SkillTeachingContext & { teachingSummary: string }): ChatMessage[] {
      const vars = buildTemplateVars(row, ctx);
      const systemPrompt = row.quizSystemPrompt || DEFAULT_QUIZ_SYSTEM_PROMPT;
      const userPrompt = row.quizUserPrompt || DEFAULT_QUIZ_USER_PROMPT;
      return [
        { role: 'system', content: renderTemplate(systemPrompt, vars) },
        { role: 'user', content: renderTemplate(userPrompt, vars) },
      ];
    },

    buildGuidancePrompt(ctx: SkillTeachingContext & { teachingSummary: string }): ChatMessage[] {
      const vars = buildTemplateVars(row, ctx);
      const systemPrompt = row.guidanceSystemPrompt || DEFAULT_GUIDANCE_SYSTEM_PROMPT;
      const userPrompt = row.guidanceUserPrompt || DEFAULT_GUIDANCE_USER_PROMPT;
      return [
        { role: 'system', content: renderTemplate(systemPrompt, vars) },
        { role: 'user', content: renderTemplate(userPrompt, vars) },
      ];
    },

    teachingSections: DEFAULT_TEACHING_SECTIONS,
    statusLabels: POINT_STATUS_LABELS,
    activityTypeLabels: ACTIVITY_TYPE_LABELS,
  };
}

/** Extract skillId from route param, query DB, and return config */
export async function resolveSkill(db: ReturnType<typeof useDB>, event: H3Event): Promise<{ skillId: string; config: SkillConfig }> {
  const skillId = getRouterParam(event, 'skillId');
  if (!skillId) {
    throw createError({ statusCode: 400, message: '缺少 skillId' });
  }
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
