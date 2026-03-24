/**
 * Language configuration registry for vocab-tracker.
 * Each supported language defines its display info, TTS locale,
 * LLM prompt builders, and CSV column alias for word import.
 */
import { createError } from 'h3';

export interface LanguageConfig {
  /** Display name in Chinese, e.g. '法语' */
  displayName: string;
  /** Native name, e.g. 'Français' */
  nativeName: string;
  /** BCP-47 tag for Web Speech API, e.g. 'fr-FR' */
  ttsLang: string;
  /** Builds the system prompt for word translation */
  translatePromptBuilder: (interestContext?: string) => string;
  /** Builds the system prompt for word chat */
  chatPromptBuilder: (word: string) => string;
  /** Accepted CSV column header alias besides 'word' */
  csvColumnAlias: string;
}

// ---------------------------------------------------------------------------
// French
// ---------------------------------------------------------------------------

function buildFrenchTranslatePrompt(interestContext?: string): string {
  const context = interestContext || '足球';
  return `你是法语学习助手。用户会给你一个法语单词，请提供详细的中文学习资料。

要求：
1. 返回严格的 JSON 格式，不要其他内容
2. 字段说明：
   - definition: 简洁的中文释义（一句话）
   - partOfSpeech: 词性（如 "n." / "v." / "adj." 等）
   - examples: 数组格式，包含 3 个实用例句（每个例句包含 sentence 和 translation。难度从简单到复杂递进。第3个例句如果这个词能自然地用在${context}语境中，就用${context}相关的句子；如果不自然就用其他场景）
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

function buildFrenchChatPrompt(word: string): string {
  return `你是一位友好的法语教学助手。用户正在学习法语单词 "${word}"。请用中文回答用户的问题，必要时引用法语原文。帮助用户理解这个词的用法、语法、文化背景等。`;
}

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------

function buildEnglishTranslatePrompt(interestContext?: string): string {
  const context = interestContext || '足球';
  return `你是英语学习助手。用户会给你一个英语单词，请提供详细的中文学习资料。

要求：
1. 返回严格的 JSON 格式，不要其他内容
2. 字段说明：
   - definition: 简洁的中文释义（一句话）
   - partOfSpeech: 词性（如 "n." / "v." / "adj." 等）
   - examples: 数组格式，包含 3 个实用例句（每个例句包含 sentence 和 translation。难度从简单到复杂递进。第3个例句如果这个词能自然地用在${context}语境中，就用${context}相关的句子；如果不自然就用其他场景）
   - synonyms: 同义词（如有）
   - antonyms: 反义词（如有）
   - wordFamily: 词族/派生词（如有）
   - collocations: 常用搭配（如有）

JSON 格式：
{
  "definition": "中文释义",
  "partOfSpeech": "词性",
  "examples": [
    { "sentence": "英语例句1", "translation": "中文翻译1" },
    { "sentence": "英语例句2", "translation": "中文翻译2" },
    { "sentence": "英语例句3", "translation": "中文翻译3" }
  ],
  "synonyms": "同义词",
  "antonyms": "反义词",
  "wordFamily": "词族",
  "collocations": "常用搭配"
}`;
}

function buildEnglishChatPrompt(word: string): string {
  return `你是一位友好的英语教学助手。用户正在学习英语单词 "${word}"。请用中文回答用户的问题，必要时引用英语原文。帮助用户理解这个词的用法、语法、文化背景等。`;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const LANGUAGES = new Map<string, LanguageConfig>([
  ['fr', {
    displayName: '法语',
    nativeName: 'Français',
    ttsLang: 'fr-FR',
    translatePromptBuilder: buildFrenchTranslatePrompt,
    chatPromptBuilder: buildFrenchChatPrompt,
    csvColumnAlias: 'french_word',
  }],
  ['en', {
    displayName: '英语',
    nativeName: 'English',
    ttsLang: 'en-US',
    translatePromptBuilder: buildEnglishTranslatePrompt,
    chatPromptBuilder: buildEnglishChatPrompt,
    csvColumnAlias: 'english_word',
  }],
]);

/**
 * Get language config by code. Throws if the language is not registered.
 */
export function getLanguageConfig(code: string): LanguageConfig {
  const config = LANGUAGES.get(code);
  if (!config) {
    throw createError({ statusCode: 400, message: `Unsupported language code: "${code}". Supported: ${[...LANGUAGES.keys()].join(', ')}` });
  }
  return config;
}
