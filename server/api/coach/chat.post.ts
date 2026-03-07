import { eq, desc, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { coachProfile, coachConversations, coachMemories, skills, focusPlans } from '~/server/database/schema';
import type { ChatMessage } from '~/server/lib/llm';
import { resolveProvider } from '~/server/utils/llm-provider';
import { throwLlmError } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { message, context = 'chat', skillId } = body;

  if (!message || typeof message !== 'string') {
    throw createError({ statusCode: 400, message: 'message 是必填字段' });
  }

  const db = useDB();

  // Load coach profile
  let [profile] = await db.select().from(coachProfile);
  if (!profile) {
    const now = Date.now();
    [profile] = await db.insert(coachProfile).values({
      id: 1, content: '', currentFocus: '', version: 0, updatedAt: now,
    }).returning();
  }

  // Load relevant memories
  const memories = await loadRelevantMemories(db, skillId);

  // Load active focus plans for context
  const plans = await db.select({
    skillName: skills.name,
    targetTier: focusPlans.targetTier,
    targetDate: focusPlans.targetDate,
  }).from(focusPlans)
    .leftJoin(skills, eq(skills.id, focusPlans.skillId))
    .where(eq(focusPlans.status, 'active'));

  // Build system prompt
  const systemPrompt = buildCoachSystemPrompt(profile, memories, plans, context);

  // Build conversation messages
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ];

  const { provider } = await resolveProvider(db);

  try {
    const reply = await provider.chat(messages, {
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 60000,
    });

    // Save conversation
    const now = Date.now();
    const [conversation] = await db.insert(coachConversations).values({
      context,
      skillId: skillId || null,
      messages: JSON.stringify([
        { role: 'user', content: message },
        { role: 'assistant', content: reply },
      ]),
      createdAt: now,
    }).returning();

    return {
      reply,
      conversationId: conversation.id,
    };
  } catch (error) {
    throwLlmError(error, '教练对话失败');
  }
});

async function loadRelevantMemories(db: ReturnType<typeof useDB>, skillId?: number) {
  let query = db.select().from(coachMemories)
    .orderBy(desc(coachMemories.importance), desc(coachMemories.createdAt))
    .limit(5);

  // If skillId provided, try to find memories related to this skill
  // For now, just get the most important recent memories
  return query;
}

function buildCoachSystemPrompt(
  profile: { content: string; currentFocus: string },
  memories: Array<{ summary: string }>,
  plans: Array<{ skillName: string | null; targetTier: number; targetDate: string }>,
  context: string,
) {
  const TIER_NAMES: Record<number, string> = {
    1: '入门', 2: '基础', 3: '胜任', 4: '精通', 5: '卓越',
  };

  let prompt = `你是用户的个人能力教练。

## 你的原则
- 严格、诚实、以证据说话
- 不恭维、不说空话、不回避问题
- 每次回复必须有具体、可执行的建议
- 关注质量而非数量——用户在"刷数据"时直接指出
- 不可量化的方面（情绪、社交等）可以讨论但不赋予分数
- 用中文回复`;

  if (profile.content) {
    prompt += `\n\n## 用户画像\n${profile.content}`;
  }

  if (profile.currentFocus) {
    prompt += `\n\n## 当前提升焦点\n${profile.currentFocus}`;
  }

  if (plans.length > 0) {
    prompt += `\n\n## 活跃焦点计划`;
    for (const p of plans) {
      prompt += `\n- ${p.skillName || '未知技能'}: 目标 ${TIER_NAMES[p.targetTier] || p.targetTier}，截止 ${p.targetDate}`;
    }
  }

  if (memories.length > 0) {
    prompt += `\n\n## 相关历史记忆`;
    for (const m of memories) {
      prompt += `\n- ${m.summary}`;
    }
  }

  prompt += `\n\n## 当前对话场景\n${context}`;

  return prompt;
}
