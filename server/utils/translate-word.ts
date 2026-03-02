import type { ChatMessage, TranslateResult } from '../lib/llm';
import { resolveProvider } from './llm-provider';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { definitions } from '../database/schemas/srs';

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

/** 修复 LLM 返回的 JSON 中未转义的双引号 */
function repairJson(raw: string): string {
  let result = '';
  let inString = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    // 已转义的字符，原样保留
    if (ch === '\\' && inString) {
      result += ch + (raw[i + 1] || '');
      i++;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
      } else {
        // 判断这个引号是字符串结束还是未转义的内嵌引号
        const after = raw.slice(i + 1).trimStart();
        if (after.length === 0 || /^[,}\]:]/.test(after)) {
          // 后面是 JSON 结构符号，说明是真正的闭合引号
          inString = false;
          result += ch;
        } else {
          // 未转义的内嵌引号，加反斜杠
          result += '\\"';
        }
      }
    } else {
      result += ch;
    }
  }

  return result;
}

/** 解析翻译 JSON 响应 */
function parseTranslationJson(text: string) {
  // 去除 markdown 代码块
  const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`翻译响应中未找到 JSON: ${text.slice(0, 200)}`);
  }

  let data: Record<string, unknown>;
  const jsonStr = jsonMatch[0];

  try {
    data = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    // JSON 解析失败，尝试修复未转义的引号后重试
    data = JSON.parse(repairJson(jsonStr)) as Record<string, unknown>;
  }

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
