import { useDB } from '~/server/database';
import { VALID_MILESTONE_TYPES, VALID_VERIFY_METHODS } from '~/server/database/schema';
import type { ChatMessage } from '~/server/lib/llm';
import { resolveProvider } from '~/server/utils/llm-provider';
import { throwLlmError } from '~/server/utils/handler-helpers';

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

const REFINE_SYSTEM_PROMPT = `你是一个技能学习专家。根据用户的反馈修改里程碑体系。

规则：
- 保持5个段位（入门/基础/胜任/精通/卓越）结构
- 每段位 2-4 个里程碑
- 里程碑必须具体、可验证
- 只修改用户指出的部分，其余保持不变

返回完整的修改后 JSON（用 \`\`\`json 包裹），格式同上。`;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { name, description, categoryName, currentMilestones, refinementPrompt } = body;

  if (!name) {
    throw createError({ statusCode: 400, message: '技能名称不能为空' });
  }

  const db = useDB(event);
  const { provider } = await resolveProvider(db);

  const isRefinement = refinementPrompt && currentMilestones;

  const messages: ChatMessage[] = isRefinement
    ? [
        { role: 'system', content: REFINE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `技能名称：${name}\n技能描述：${description || '无'}\n所属大类：${categoryName || '未知'}\n\n当前里程碑：\n${JSON.stringify(currentMilestones, null, 2)}\n\n修改要求：${refinementPrompt}`,
        },
      ]
    : [
        { role: 'system', content: GENERATE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `技能名称：${name}\n技能描述：${description || '无'}\n所属大类：${categoryName || '未知'}`,
        },
      ];

  try {
    const reply = await provider.chat(messages, {
      temperature: 0.7,
      maxTokens: 3000,
      timeout: 60000,
    });

    // Try ```json block first, then raw JSON
    const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : reply.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0];
    if (!jsonStr) {
      throw createError({ statusCode: 502, message: 'AI 未返回有效的里程碑数据' });
    }

    const parsed = JSON.parse(jsonStr);
    // Support both { milestones: [...] } and bare array [...]
    const rawMilestones = Array.isArray(parsed) ? parsed : parsed?.milestones;
    if (!Array.isArray(rawMilestones)) {
      throw createError({ statusCode: 502, message: 'AI 返回的数据格式无效' });
    }

    const milestones = rawMilestones
      .filter((m: any) =>
        m.tier >= 1 && m.tier <= 5 &&
        m.title &&
        VALID_MILESTONE_TYPES.includes(m.type) &&
        VALID_VERIFY_METHODS.includes(m.verify),
      )
      .map((m: any, idx: number) => ({
        tier: m.tier,
        title: m.title,
        description: m.description || null,
        type: m.type,
        verify: m.verify,
        config: m.config || {},
        sortOrder: idx,
      }));

    return { milestones };
  } catch (error) {
    if ((error as any)?.statusCode) throw error;
    throwLlmError(error, 'AI 生成里程碑失败');
  }
});
