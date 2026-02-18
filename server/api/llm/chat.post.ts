import { eq } from 'drizzle-orm';
import { llmProviders } from '../../database/schemas/llm';
import { ProviderFactory, LlmError } from '../../lib/llm';
import type { ChatMessage } from '../../lib/llm';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { messages, providerId, options } = body;

  // 校验 messages
  if (!Array.isArray(messages) || messages.length === 0) {
    throw createError({ statusCode: 400, message: 'messages 是必填字段且不能为空数组' });
  }

  // 校验每条消息格式
  const validRoles = ['system', 'user', 'assistant'];
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') {
      throw createError({ statusCode: 400, message: '每条 message 必须是对象' });
    }
    if (!validRoles.includes(msg.role)) {
      throw createError({ statusCode: 400, message: `message.role 必须是 ${validRoles.join(', ')} 之一` });
    }
    if (!msg.content || typeof msg.content !== 'string') {
      throw createError({ statusCode: 400, message: 'message.content 是必填字符串' });
    }
  }

  // 校验 options
  if (options) {
    if (options.temperature !== undefined && (typeof options.temperature !== 'number' || options.temperature < 0 || options.temperature > 1)) {
      throw createError({ statusCode: 400, message: 'temperature 必须是 0-1 之间的数字' });
    }
    if (options.maxTokens !== undefined && (typeof options.maxTokens !== 'number' || options.maxTokens < 1)) {
      throw createError({ statusCode: 400, message: 'maxTokens 必须是正整数' });
    }
    if (options.timeout !== undefined && (typeof options.timeout !== 'number' || options.timeout < 1000)) {
      throw createError({ statusCode: 400, message: 'timeout 必须大于 1000ms' });
    }
  }

  const db = useDB();

  // 获取 provider 配置
  let providerConfig;
  if (providerId) {
    const result = await db.select().from(llmProviders).where(eq(llmProviders.id, Number(providerId))).limit(1);
    if (result.length === 0) {
      throw createError({ statusCode: 404, message: '指定的 Provider 不存在' });
    }
    providerConfig = result[0];
  } else {
    const result = await db.select().from(llmProviders).where(eq(llmProviders.isDefault, true)).limit(1);
    if (result.length === 0) {
      throw createError({ statusCode: 400, message: '未配置默认 LLM Provider，请先在设置中配置' });
    }
    providerConfig = result[0];
  }

  if (!providerConfig.isEnabled) {
    throw createError({ statusCode: 400, message: '该 Provider 已被禁用' });
  }

  // 创建 provider 实例并调用
  try {
    const provider = ProviderFactory.fromDbConfig(providerConfig);
    const content = await provider.chat(messages as ChatMessage[], options);

    return {
      content,
      meta: {
        provider: providerConfig.provider,
        modelName: providerConfig.modelName,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof LlmError) {
      throw createError({
        statusCode: 502,
        message: error.message,
        data: { type: error.type },
      });
    }
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'LLM 调用失败',
    });
  }
});
