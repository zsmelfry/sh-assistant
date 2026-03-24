import { useDB } from '~/server/database';
import { resolveProvider } from '~/server/utils/llm-provider';
import { throwLlmError } from '~/server/utils/handler-helpers';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const projectId = requireNumericParam(event, 'id', '事项');
  const body = await readBody(event);

  if (!body.description || typeof body.description !== 'string') {
    throw createError({ statusCode: 400, message: '请描述你需要的图表内容' });
  }

  const diagramType = body.type || 'flowchart';

  const prompt = `请根据以下描述生成 Mermaid 图表代码。

图表类型：${diagramType}
描述：${body.description}

要求：
1. 只输出 Mermaid 代码，不要包含 \`\`\`mermaid 标记
2. 使用中文标签
3. 代码要符合 Mermaid 语法规范
4. 图表要清晰、结构合理

请直接输出 Mermaid 代码：`;

  const db = useDB(event);
  const { provider } = await resolveProvider(db, body.providerId);

  try {
    const code = await provider.chat([{ role: 'user', content: prompt }], {
      maxTokens: 1000,
      temperature: 0.3,
    });

    // Clean up: remove possible markdown fences
    const cleaned = code
      .replace(/^```mermaid\s*/i, '')
      .replace(/^```\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();

    return { mermaidCode: cleaned, type: diagramType };
  } catch (error) {
    throwLlmError(error, 'AI 图表生成失败');
  }
});
