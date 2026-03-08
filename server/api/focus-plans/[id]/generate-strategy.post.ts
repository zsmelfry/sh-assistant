import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { focusPlans, skills, milestones, milestoneCompletions, TIER_NAMES } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import type { ChatMessage } from '~/server/lib/llm';
import { resolveProvider } from '~/server/utils/llm-provider';
import { throwLlmError } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '焦点计划');
  const db = useDB();

  const [plan] = await db.select().from(focusPlans).where(eq(focusPlans.id, id));
  if (!plan) {
    throw createError({ statusCode: 404, message: '焦点计划不存在' });
  }

  const [skill] = await db.select().from(skills).where(eq(skills.id, plan.skillId));
  if (!skill) {
    throw createError({ statusCode: 404, message: '关联技能不存在' });
  }

  // Get pending milestones
  const allMilestones = await db
    .select({
      id: milestones.id,
      tier: milestones.tier,
      title: milestones.title,
      completionId: milestoneCompletions.id,
    })
    .from(milestones)
    .leftJoin(milestoneCompletions, eq(milestoneCompletions.milestoneId, milestones.id))
    .where(eq(milestones.skillId, plan.skillId))
    .orderBy(milestones.tier, milestones.sortOrder);

  const pendingMilestones = allMilestones
    .filter((m) => !m.completionId && m.tier > skill.currentTier && m.tier <= plan.targetTier)
    .map((m) => `- [${TIER_NAMES[m.tier]}] ${m.title}`);

  const { provider } = await resolveProvider(db);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个个人能力教练。为用户的焦点技能生成提升策略。

要求：
- 基于当前段位和目标段位的差距
- 列出具体的、可执行的行动（不要空话）
- 建议关联到平台已有模块（习惯打卡、年度计划、技能学习）
- 设定合理的时间节奏
- 如果目标不合理（如3个月从入门到精通），直接指出
- 用 Markdown 格式输出
- 用中文回复`,
    },
    {
      role: 'user',
      content: `技能：${skill.name}
当前段位：${skill.currentTier} (${TIER_NAMES[skill.currentTier]})
目标段位：${plan.targetTier} (${TIER_NAMES[plan.targetTier]})
截止日期：${plan.targetDate}
当前未完成里程碑：
${pendingMilestones.join('\n') || '无'}
`,
    },
  ];

  try {
    const strategy = await provider.chat(messages, {
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 60000,
    });

    // Save strategy to plan
    await db.update(focusPlans).set({
      strategy,
      updatedAt: Date.now(),
    }).where(eq(focusPlans.id, id));

    return { strategy };
  } catch (error) {
    throwLlmError(error, 'AI 生成策略失败');
  }
});
