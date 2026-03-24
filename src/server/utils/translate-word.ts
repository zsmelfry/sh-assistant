import type { ChatMessage, TranslateResult } from '../lib/llm';
import { resolveProvider } from './llm-provider';
import { parseLlmJsonObject } from './parse-llm-json';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { definitions } from '../database/schemas/srs';
import { getLanguageConfig } from '~/server/lib/vocab/languages';

/** 解析翻译 JSON 响应 */
function parseTranslationJson(text: string) {
  const data = parseLlmJsonObject<Record<string, unknown>>(text);

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
  interestContext?: string;
  language?: string;
}

/**
 * Translate a word using the configured LLM provider.
 * Language is determined by options.language (default: 'fr').
 * Call this directly from server code — no HTTP round-trip needed.
 */
export async function translateWord(
  db: BetterSQLite3Database<any>,
  word: string,
  options?: TranslateWordOptions,
): Promise<TranslateResult> {
  const { provider, config: providerConfig } = await resolveProvider(db, options?.providerId);

  const language = options?.language || 'fr';
  const langConfig = getLanguageConfig(language);
  const systemPrompt = langConfig.translatePromptBuilder(options?.interestContext);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请为${langConfig.displayName}单词 "${word.trim()}" 生成学习资料（仅返回 JSON）：` },
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

/**
 * Save a TranslateResult into the definitions cache table. Returns the inserted row.
 */
export async function cacheDefinition(
  db: BetterSQLite3Database<any>,
  wordId: number,
  translateResult: TranslateResult,
) {
  const [row] = await db.insert(definitions).values({
    wordId,
    definition: translateResult.definition,
    partOfSpeech: translateResult.partOfSpeech,
    example: translateResult.examples[0]?.sentence || '',
    exampleTranslation: translateResult.examples[0]?.translation || '',
    examples: JSON.stringify(translateResult.examples),
    synonyms: translateResult.synonyms,
    antonyms: translateResult.antonyms,
    wordFamily: translateResult.wordFamily,
    collocations: translateResult.collocations,
    fetchedAt: Date.now(),
    modelProvider: translateResult.meta.provider,
    modelName: translateResult.meta.modelName,
  }).returning();
  return row;
}
