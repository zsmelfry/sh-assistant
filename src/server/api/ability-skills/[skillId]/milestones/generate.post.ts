import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills, milestones, abilityCategories, VALID_MILESTONE_TYPES, VALID_VERIFY_METHODS } from '~/server/database/schema';
import { requireNumericParam, throwLlmError } from '~/server/utils/handler-helpers';
import type { ChatMessage } from '~/server/lib/llm';
import { resolveProvider } from '~/server/utils/llm-provider';

const GENERATE_SYSTEM_PROMPT = `你是一个技能学习专家。为以下技能生成里程碑体系。

要求：
- 分5个段位（入门/基础/胜任/精通/卓越），每段位 2-4 个里程碑
- 每段位必须包含至少一个 quality 类型里程碑（不能全是数量堆积）
- 里程碑必须具体、可验证，用数字或明确标准
- 参考同类技能的常见学习路径和认证体系
- 验证方式要务实：能用平台数据的用 platform_auto，其次用 evidence，最后才用 self_declare

参考官方模板的难度锚点：
- 入门 ≈ "完全初学者经过1-3个月练习可达到"
- 基础 ≈ "坚持半年到一年的业余爱好者水平"
- 胜任 ≈ "认真训练2-3年的中级水平"
- 精通 ≈ "专业级或多年深入实践"
- 卓越 ≈ "顶尖或有公认成就"

返回 JSON 格式（用 \`\`\`json 包裹）：
\`\`\`json
{
  "milestones": [
    {
      "tier": 1,
      "title": "里程碑标题",
      "description": "详细说明",
      "type": "quantity|consistency|achievement|quality",
      "verify": "platform_auto|platform_test|evidence|self_declare",
      "config": {}
    }
  ]
}
\`\`\``;

export default defineEventHandler(async (event) => {
  const skillId = requireNumericParam(event, 'skillId', '技能');
  const db = useDB(event);

  const [skill] = await db.select().from(skills).where(eq(skills.id, skillId));
  if (!skill) {
    throw createError({ statusCode: 404, message: '技能不存在' });
  }

  const [category] = await db.select().from(abilityCategories)
    .where(eq(abilityCategories.id, skill.categoryId));

  const { provider } = await resolveProvider(db);

  const messages: ChatMessage[] = [
    { role: 'system', content: GENERATE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `技能名称：${skill.name}\n技能描述：${skill.description || '无'}\n所属大类：${category?.name || '未知'}`,
    },
  ];

  try {
    const reply = await provider.chat(messages, {
      temperature: 0.7,
      maxTokens: 3000,
      timeout: 60000,
    });

    // Parse JSON from response
    const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      throw createError({ statusCode: 502, message: 'AI 未返回有效的里程碑数据' });
    }

    const parsed = JSON.parse(jsonMatch[1]);
    if (!parsed.milestones || !Array.isArray(parsed.milestones)) {
      throw createError({ statusCode: 502, message: 'AI 返回的数据格式无效' });
    }

    // Insert milestones
    const now = Date.now();
    const toInsert = parsed.milestones
      .filter((m: any) =>
        m.tier >= 1 && m.tier <= 5 &&
        m.title &&
        VALID_MILESTONE_TYPES.includes(m.type) &&
        VALID_VERIFY_METHODS.includes(m.verify),
      )
      .map((m: any, idx: number) => ({
        skillId,
        tier: m.tier,
        title: m.title,
        description: m.description || null,
        milestoneType: m.type,
        verifyMethod: m.verify,
        verifyConfig: m.config ? JSON.stringify(m.config) : null,
        sortOrder: idx,
        createdAt: now,
        updatedAt: now,
      }));

    if (toInsert.length > 0) {
      await db.insert(milestones).values(toInsert);
    }

    // Return all milestones for this skill
    const allMilestones = await db.select().from(milestones)
      .where(eq(milestones.skillId, skillId))
      .orderBy(milestones.tier, milestones.sortOrder);

    return {
      generated: toInsert.length,
      milestones: allMilestones,
    };
  } catch (error) {
    if ((error as any)?.statusCode) throw error;
    throwLlmError(error, 'AI 生成里程碑失败');
  }
});
