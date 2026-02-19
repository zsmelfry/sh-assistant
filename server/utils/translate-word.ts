import { LlmError } from '../lib/llm';
import type { ChatMessage, TranslateResult } from '../lib/llm';
import { resolveProvider } from './llm-provider';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

/** 构建翻译系统提示词 */
function buildTranslateSystemPrompt(): string {
  return `你是法语学习助手。用户会给你一个法语单词，请提供详细的中文学习资料。

要求：
1. 返回严格的 JSON 格式，不要其他内容
2. 字段说明：
   - definition: 简洁的中文释义（一句话）
   - partOfSpeech: 词性（如 "n." / "v." / "adj." 等）
   - examples: 数组格式，包含 3 个实用例句（每个例句包含 sentence 和 translation。难度从简单到复杂递进。第3个例句如果这个词能自然地用在足球语境中，就用足球相关的句子；如果不自然就用其他场景）
   - synonyms: 同义词（如有）
   - antonyms: 反义词（如有）
   - wordFamily: 词族/派生词（如有）
   - collocations: 常用搭配（如有）

JSON 格式：
{
  "definition": "中文释义",
  "partOfSpeech": "词性",
  "examples": [
    { "sentence": "法语例句1", "translation": "中文翻译1" },
    { "sentence": "法语例句2", "translation": "中文翻译2" },
    { "sentence": "法语例句3", "translation": "中文翻译3" }
  ],
  "synonyms": "同义词",
  "antonyms": "反义词",
  "wordFamily": "词族",
  "collocations": "常用搭配"
}`;
}

/** 解析翻译 JSON 响应 */
function parseTranslationJson(text: string) {
  // 去除 markdown 代码块
  const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`翻译响应中未找到 JSON: ${text.slice(0, 200)}`);
  }

  const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  // 验证必需字段
  if (!data.definition || typeof data.definition !== 'string') {
    throw new Error('翻译结果缺少 definition 字段');
  }
  if (!/[\u4e00-\u9fff]/.test(data.definition)) {
    throw new Error(`翻译结果无效: "${data.definition}"`);
  }

  // 解析 examples
  let examples: Array<{ sentence: string; translation: string }> = [];
  if (Array.isArray(data.examples)) {
    examples = data.examples.filter(
      (e: unknown) => e && typeof e === 'object' && 'sentence' in (e as object) && 'translation' in (e as object),
    ) as Array<{ sentence: string; translation: string }>;
  }

  return {
    definition: String(data.definition),
    partOfSpeech: String(data.partOfSpeech || ''),
    examples,
    synonyms: String(data.synonyms || ''),
    antonyms: String(data.antonyms || ''),
    wordFamily: String(data.wordFamily || ''),
    collocations: String(data.collocations || ''),
  };
}

interface TranslateWordOptions {
  providerId?: number;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

/**
 * Translate a French word using the configured LLM provider.
 * Call this directly from server code — no HTTP round-trip needed.
 */
export async function translateWord(
  db: BetterSQLite3Database<any>,
  word: string,
  options?: TranslateWordOptions,
): Promise<TranslateResult> {
  const { provider, config: providerConfig } = await resolveProvider(db, options?.providerId);

  const messages: ChatMessage[] = [
    { role: 'system', content: buildTranslateSystemPrompt() },
    { role: 'user', content: `请为法语单词 "${word.trim()}" 生成学习资料（仅返回 JSON）：` },
  ];

  const rawContent = await provider.chat(messages, {
    temperature: options?.temperature ?? 0.5,
    maxTokens: options?.maxTokens ?? 2000,
    timeout: options?.timeout ?? 35000,
  });

  const parsed = parseTranslationJson(rawContent);

  return {
    ...parsed,
    meta: {
      provider: providerConfig.provider,
      modelName: providerConfig.modelName,
      timestamp: new Date().toISOString(),
    },
  };
}
