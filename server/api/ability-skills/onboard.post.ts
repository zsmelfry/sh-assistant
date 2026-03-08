import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills, milestones, skillCurrentState, abilityCategories, milestoneCompletions } from '~/server/database/schema';
import { SKILL_TEMPLATES } from '~/server/database/seeds/skill-templates';
import type { ChatMessage } from '~/server/lib/llm';
import { resolveProvider } from '~/server/utils/llm-provider';
import { throwLlmError } from '~/server/utils/handler-helpers';

const ONBOARDING_SYSTEM_PROMPT = `你是一个个人能力教练，正在帮助新用户快速建立技能档案。

目标：通过简短对话了解用户已有的技能和大致水平，生成初始技能列表。

规则：
- 用轻松的对话方式，不要像问卷
- 先问用户现在在做什么工作/学习，有什么爱好
- 根据回答，追问 2-3 个关键技能的水平（用具体场景判断段位）
- 当信息足够时（通常 2-3 轮对话后），直接生成技能列表，不要再追问确认

段位参考（★ 表示星级）：
- ★ 入门(1) = 完全初学者经过1-3个月练习可达到
- ★★ 基础(2) = 坚持半年到一年的业余爱好者水平
- ★★★ 胜任(3) = 认真训练2-3年的中级水平
- ★★★★ 精通(4) = 专业级或多年深入实践
- ★★★★★ 卓越(5) = 顶尖或有公认成就

可用的官方模板ID: ${SKILL_TEMPLATES.map(t => t.id).join(', ')}
可用的能力大类: 语言能力, 数理逻辑, 身体运动, 艺术创作, 专业技能, 生活实践, 自我管理

重要：当你准备生成技能列表时，必须在回复中同时做两件事：

1. 先用可读的文本格式展示你为用户创建的技能，例如：
"根据我们的对话，我为你创建了以下技能档案：
- 编程 [专业技能] ★★★★ 精通
- 法语 [语言能力] ★★ 基础
- 跑步 [身体运动] ★ 入门
如果有需要调整的地方可以告诉我。"

2. 然后在回复最末尾附上 JSON 数据块（用 \`\`\`json 包裹），系统会自动解析并创建技能：
\`\`\`json
{
  "skills": [
    {
      "name": "技能名",
      "categoryKey": "能力大类名",
      "templateId": "模板ID或null",
      "estimatedTier": 2,
      "states": [
        { "key": "状态键", "value": "值", "label": "显示名" }
      ]
    }
  ]
}
\`\`\``;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { message, history = [] } = body;

  if (!message || typeof message !== 'string') {
    throw createError({ statusCode: 400, message: 'message 是必填字段' });
  }

  const db = useDB();
  const { provider } = await resolveProvider(db);

  const messages: ChatMessage[] = [
    { role: 'system', content: ONBOARDING_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: message },
  ];

  try {
    const reply = await provider.chat(messages, {
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 60000,
    });

    // Check if the reply contains a JSON skill list
    const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
    let createdSkills: Array<{ id: number; name: string; tier: number }> = [];

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.skills && Array.isArray(parsed.skills)) {
          createdSkills = await createSkillsFromOnboarding(db, parsed.skills);
        }
      } catch {
        // JSON parse failed, that's ok — user will continue conversation
      }
    }

    return {
      reply,
      createdSkills,
      completed: createdSkills.length > 0,
    };
  } catch (error) {
    throwLlmError(error, 'AI 建档对话失败');
  }
});

async function createSkillsFromOnboarding(
  db: ReturnType<typeof useDB>,
  skillData: Array<{
    name: string;
    categoryKey: string;
    templateId?: string | null;
    estimatedTier: number;
    states?: Array<{ key: string; value: string; label: string }>;
  }>,
) {
  const categories = await db.select().from(abilityCategories);
  const catMap = new Map(categories.map((c) => [c.name, c.id]));
  const now = Date.now();
  const results: Array<{ id: number; name: string; tier: number }> = [];

  for (const s of skillData) {
    const categoryId = catMap.get(s.categoryKey);
    if (!categoryId) continue;

    const template = s.templateId ? SKILL_TEMPLATES.find((t) => t.id === s.templateId) : null;
    const source = template ? 'template' : 'custom';

    // Create skill
    const [skill] = await db.insert(skills).values({
      categoryId,
      name: s.name,
      source,
      templateId: template?.id || null,
      currentTier: Math.min(Math.max(s.estimatedTier || 0, 0), 5),
      status: 'active',
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    }).returning();

    // Create milestones from template
    if (template) {
      await db.insert(milestones).values(
        template.milestones.map((m, idx) => ({
          skillId: skill.id,
          tier: m.tier,
          title: m.title,
          milestoneType: m.type,
          verifyMethod: m.verify,
          verifyConfig: JSON.stringify(m.config),
          sortOrder: idx,
          createdAt: now,
          updatedAt: now,
        })),
      );

      // Pre-complete milestones for tiers below estimated tier
      if (s.estimatedTier > 0) {
        const allMilestones = await db.select().from(milestones)
          .where(eq(milestones.skillId, skill.id));

        const toComplete = allMilestones.filter((m) => m.tier <= s.estimatedTier);
        for (const m of toComplete) {
          await db.insert(milestoneCompletions).values({
            milestoneId: m.id,
            verifyMethod: 'self_declare',
            evidenceNote: '初始建档自评',
            verifiedAt: now,
            createdAt: now,
          });
        }
      }

      // Create default states
      if (template.defaultStates.length > 0) {
        await db.insert(skillCurrentState).values(
          template.defaultStates.map((st) => {
            const stateData = s.states?.find((us) => us.key === st.key);
            return {
              skillId: skill.id,
              stateKey: st.key,
              stateValue: stateData?.value || '',
              stateLabel: st.label,
              source: st.source,
              confirmedAt: now,
              expiresAfterDays: st.expiresAfterDays,
              createdAt: now,
              updatedAt: now,
            };
          }),
        );
      }
    }

    // Create user-provided states (for custom skills)
    if (!template && s.states && s.states.length > 0) {
      await db.insert(skillCurrentState).values(
        s.states.map((st) => ({
          skillId: skill.id,
          stateKey: st.key,
          stateValue: st.value || '',
          stateLabel: st.label,
          source: 'user_confirmed' as const,
          confirmedAt: now,
          expiresAfterDays: 180,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }

    results.push({ id: skill.id, name: s.name, tier: skill.currentTier });
  }

  return results;
}
