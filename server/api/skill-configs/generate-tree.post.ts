import { useDB } from '~/server/database';
import { resolveProvider } from '~/server/utils/llm-provider';
import { LlmError } from '~/server/lib/llm';
import type { SeedDomain, SeedStage } from '~/server/database/seeds/startup-map';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { name, description, providerId } = body || {};

  if (!name || typeof name !== 'string') {
    throw createError({ statusCode: 400, message: '技能名称不能为空' });
  }

  const db = useDB();
  const { provider } = await resolveProvider(db, providerId);

  const prompt = `你是一位教育体系设计专家。请为以下技能设计一个完整的知识树结构。

技能名称：${name}
${description ? `技能描述：${description}` : ''}

请设计 4-8 个知识领域（domain），每个领域包含 2-4 个主题（topic），每个主题包含 2-5 个知识点（point）。
同时设计 4-8 个学习阶段（stage），每个阶段引用一些知识点名称（按学习顺序）。

严格按以下 JSON 格式输出（不要添加任何其他文字）：
{
  "domains": [
    {
      "name": "领域名称",
      "description": "领域描述",
      "topics": [
        {
          "name": "主题名称",
          "description": "主题描述",
          "points": [
            { "name": "知识点名称", "description": "知识点描述（一句话）" }
          ]
        }
      ]
    }
  ],
  "stages": [
    {
      "name": "阶段名称",
      "description": "阶段描述",
      "objective": "学习目标",
      "pointNames": ["知识点名称1", "知识点名称2"]
    }
  ]
}

要求：
- 知识点总数控制在 30-80 个
- 阶段中的 pointNames 必须是 domains 中定义的知识点名称（精确匹配）
- 每个阶段包含 5-15 个知识点
- 从基础到高级递进排列
- 用中文输出`;

  let fullContent = '';
  try {
    const stream = provider.chatStream(
      [
        { role: 'system', content: '你是一位教育体系设计专家，擅长设计结构化的知识树。你只输出 JSON，不附加任何说明文字。' },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.3, maxTokens: 8000, timeout: 120000 },
    );
    for await (const chunk of stream) {
      fullContent += chunk;
    }
  } catch (error) {
    const message = error instanceof LlmError
      ? error.message
      : (error instanceof Error ? error.message : '知识树生成失败');
    throw createError({ statusCode: 502, message });
  }

  // Parse JSON from LLM response
  let result: { domains: SeedDomain[]; stages: SeedStage[] };
  try {
    const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    result = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(result.domains) || !Array.isArray(result.stages)) {
      throw new Error('Invalid structure');
    }
  } catch {
    throw createError({ statusCode: 502, message: '知识树解析失败，AI 返回格式异常' });
  }

  return result;
});
