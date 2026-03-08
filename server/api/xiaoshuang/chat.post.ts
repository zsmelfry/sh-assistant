import { useDB } from '~/server/database';
import type { ChatMessage } from '~/server/lib/llm';
import { resolveProvider } from '~/server/utils/llm-provider';
import { throwLlmError } from '~/server/utils/handler-helpers';
import { collectRelevantContext, formatContextForPrompt } from '~/server/lib/coach/context-builder';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { message, history = [] } = body;

  if (!message || typeof message !== 'string') {
    throw createError({ statusCode: 400, message: 'message 是必填字段' });
  }

  const db = useDB();

  // Load relevant global context based on user message
  const globalContext = await collectRelevantContext(db, message);

  // Build system prompt with global data
  let systemPrompt = `你是小爽助手——用户的个人成长教练和助手。

## 你是谁
- 你了解用户的所有数据：习惯打卡、年度计划、学习进度、能力等级、词汇学习、文章阅读、事项追踪
- 你的目标是帮助用户实现自我认知与持续成长
- 你会把不同模块的数据关联起来分析，给出跨模块的综合建议

## 你的原则
- 严格、诚实、以证据说话——不恭维、不说空话、不回避问题
- 但在用户低落时给方向，在用户突破时真诚认可
- 每次回复必须有具体、可执行的建议
- 关注质量而非数量——用户在"刷数据"时直接指出
- 主动发现不同模块之间的关联（如习惯打卡和能力提升的关系）
- 用中文回复，语气自然亲切但不油腻`;

  const dataSection = formatContextForPrompt(globalContext);
  if (dataSection) {
    systemPrompt += dataSection;
  }

  // Build conversation messages
  const priorMessages: ChatMessage[] = Array.isArray(history)
    ? history.filter((m: any) => m.role && m.content).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content),
    }))
    : [];

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...priorMessages,
    { role: 'user', content: message },
  ];

  const { provider } = await resolveProvider(db);

  try {
    const reply = await provider.chat(messages, {
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 120000,
    });

    return { reply };
  } catch (error) {
    throwLlmError(error, '小爽助手对话失败');
  }
});
