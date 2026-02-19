/** Provider 类型 */
export type ProviderType = 'claude' | 'ollama' | 'openai';

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 聊天选项 */
export interface ChatOptions {
  temperature?: number;      // 0-1, 默认 0.7
  maxTokens?: number;        // 默认 2000
  timeout?: number;          // 毫秒, 默认 30000
}

/** 聊天响应 */
export interface ChatResponse {
  content: string;
  meta: {
    provider: ProviderType;
    modelName: string;
    timestamp: string;
  };
}

/** 翻译 API 响应 */
export interface TranslateResult {
  definition: string;
  partOfSpeech: string;
  examples: Array<{ sentence: string; translation: string }>;
  synonyms: string;
  antonyms: string;
  wordFamily: string;
  collocations: string;
  meta: { provider: string; modelName: string; timestamp: string };
}

/** Provider 健康状态 */
export interface HealthStatus {
  available: boolean;
  latency?: number;
  error?: string;
}

/** LLM Provider 接口 */
export interface ILlmProvider {
  getType(): ProviderType;
  getModelName(): string;
  isAvailable(): Promise<boolean>;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}

/** 错误类型 */
export enum LlmErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  AUTH_ERROR = 'AUTH_ERROR',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
}

export class LlmError extends Error {
  constructor(
    public type: LlmErrorType,
    message: string,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}
