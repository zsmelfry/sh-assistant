import { LlmError } from '../../lib/llm';
import { translateWord } from '../../utils/translate-word';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { word, providerId, options } = body;

  // 校验
  if (!word || typeof word !== 'string' || word.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'word 是必填字段' });
  }

  const db = useDB();

  try {
    return await translateWord(db, word, {
      providerId: providerId ? Number(providerId) : undefined,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      timeout: options?.timeout,
    });
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
      message: error instanceof Error ? error.message : '翻译失败',
    });
  }
});
