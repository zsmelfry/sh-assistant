import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skillConfigs } from '~/server/database/schema';

const SKILL_ID_PATTERN = /^[a-z0-9-]+$/;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const {
    skillId, name, description, icon,
    teachingSystemPrompt, teachingUserPrompt,
    chatSystemPrompt, taskSystemPrompt, taskUserPrompt,
    quizSystemPrompt, quizUserPrompt,
    guidanceSystemPrompt, guidanceUserPrompt,
    sortOrder,
    linkedAbilitySkillId,
  } = body || {};

  if (!skillId || typeof skillId !== 'string') {
    throw createError({ statusCode: 400, message: 'skillId 不能为空' });
  }
  if (!SKILL_ID_PATTERN.test(skillId)) {
    throw createError({ statusCode: 400, message: 'skillId 只能包含小写字母、数字和连字符' });
  }
  if (!name || typeof name !== 'string') {
    throw createError({ statusCode: 400, message: 'name 不能为空' });
  }
  if (!teachingSystemPrompt || !teachingUserPrompt || !chatSystemPrompt || !taskSystemPrompt || !taskUserPrompt) {
    throw createError({ statusCode: 400, message: '所有 prompt 字段不能为空' });
  }

  const db = useDB();

  // Check uniqueness
  const [existing] = await db.select().from(skillConfigs)
    .where(eq(skillConfigs.skillId, skillId)).limit(1);
  if (existing) {
    throw createError({ statusCode: 409, message: `skillId '${skillId}' 已存在` });
  }

  const now = Date.now();
  const [created] = await db.insert(skillConfigs).values({
    skillId,
    name,
    description: description || null,
    icon: icon || 'BookOpen',
    teachingSystemPrompt,
    teachingUserPrompt,
    chatSystemPrompt,
    taskSystemPrompt,
    taskUserPrompt,
    ...(quizSystemPrompt ? { quizSystemPrompt } : {}),
    ...(quizUserPrompt ? { quizUserPrompt } : {}),
    ...(guidanceSystemPrompt ? { guidanceSystemPrompt } : {}),
    ...(guidanceUserPrompt ? { guidanceUserPrompt } : {}),
    ...(body.features ? { features: body.features } : {}),
    ...(linkedAbilitySkillId ? { linkedAbilitySkillId } : {}),
    sortOrder: sortOrder ?? 100,
    createdAt: now,
    updatedAt: now,
  }).returning();

  return created;
});
