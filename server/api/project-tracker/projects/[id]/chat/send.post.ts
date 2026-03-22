import { eq, desc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptChats, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireNonEmpty, requireEntity } from '~/server/utils/handler-helpers';
import { resolveProvider } from '~/server/utils/llm-provider';
import { throwLlmError } from '~/server/utils/handler-helpers';
import { buildProjectContext } from '~/server/lib/project-tracker/build-context';

export default defineEventHandler(async (event) => {
  const projectId = requireNumericParam(event, 'id', '事项');
  const body = await readBody(event);
  const content = requireNonEmpty(body.content, '消息内容');
  const db = useDB(event);

  await requireEntity(db, ptProjects, projectId, '事项');

  // Save user message
  const now = Date.now();
  await db.insert(ptChats).values({
    projectId,
    role: 'user',
    content,
    createdAt: now,
  });

  // Build context
  const projectContext = await buildProjectContext(db, projectId);

  // Get recent history (last 20 messages)
  const history = await db.select().from(ptChats)
    .where(eq(ptChats.projectId, projectId))
    .orderBy(desc(ptChats.createdAt))
    .limit(20);

  // Reverse to chronological order
  history.reverse();

  // Build messages for LLM
  const messages: { role: string; content: string }[] = [
    {
      role: 'system',
      content: `你是一个事项管理助手。以下是当前事项的详细信息：

${projectContext}

请基于以上信息回答用户的问题。你可以：
- 分析项目进度
- 建议下一步行动
- 帮助分解任务
- 总结笔记内容
- 建议 Mermaid 图表代码
- 提供项目管理建议

请用简洁、有用的方式回答。`,
    },
    ...history.map(m => ({ role: m.role, content: m.content })),
  ];

  const { provider } = await resolveProvider(db, body.providerId);

  try {
    const reply = await provider.chat(messages, {
      maxTokens: 1000,
      temperature: 0.7,
    });

    // Save assistant reply
    await db.insert(ptChats).values({
      projectId,
      role: 'assistant',
      content: reply,
      createdAt: Date.now(),
    });

    return { content: reply };
  } catch (error) {
    throwLlmError(error, 'AI 回复失败');
  }
});
