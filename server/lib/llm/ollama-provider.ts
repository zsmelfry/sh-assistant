import { BaseLlmProvider } from './base-provider';
import type { ChatMessage, ChatOptions, ProviderType } from './types';
import { LlmError, LlmErrorType } from './types';

export interface OllamaModelDetails {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export class OllamaProvider extends BaseLlmProvider {
  private readonly endpoint: string;

  constructor(
    private readonly modelName: string,
    endpoint = 'http://localhost:11434',
  ) {
    super();
    this.endpoint = endpoint.replace(/\/$/, '');
  }

  getType(): ProviderType {
    return 'ollama';
  }

  getModelName(): string {
    return this.modelName;
  }

  protected async _checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return false;

      const data = await response.json() as { models: OllamaModelDetails[] };
      return data.models.some(m => m.name === this.modelName);
    } catch {
      return false;
    }
  }

  protected async _chat(
    messages: ChatMessage[],
    options: Required<ChatOptions>,
  ): Promise<string> {
    const prompt = this.formatMessages(messages);

    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature,
            num_predict: options.maxTokens,
          },
        }),
        signal: AbortSignal.timeout(options.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new LlmError(
          response.status === 404 ? LlmErrorType.MODEL_NOT_FOUND : LlmErrorType.NETWORK_ERROR,
          `Ollama API 错误 (${response.status}): ${errorText}`,
        );
      }

      const data = await response.json() as { response: string };
      return data.response.trim();
    } catch (error) {
      if (error instanceof LlmError) throw error;

      if ((error as Error).name === 'AbortError' || (error as Error).message?.includes('timeout')) {
        throw new LlmError(LlmErrorType.TIMEOUT, `Ollama 请求超时 (${options.timeout}ms)`);
      }

      throw new LlmError(
        LlmErrorType.NETWORK_ERROR,
        `Ollama 调用失败: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  protected async *_chatStream(
    messages: ChatMessage[],
    options: Required<ChatOptions>,
  ): AsyncIterable<string> {
    const prompt = this.formatMessages(messages);

    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelName,
        prompt,
        stream: true,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
        },
      }),
      signal: AbortSignal.timeout(options.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new LlmError(
        response.status === 404 ? LlmErrorType.MODEL_NOT_FOUND : LlmErrorType.NETWORK_ERROR,
        `Ollama API 错误 (${response.status}): ${errorText}`,
      );
    }

    if (!response.body) {
      throw new LlmError(LlmErrorType.INVALID_RESPONSE, 'Ollama 返回空的 response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        // Ollama streams NDJSON — each line is a JSON object with { response: string, done: boolean }
        for (const line of text.split('\n')) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as { response: string; done: boolean };
            if (data.response) {
              yield data.response;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** 格式化显示名称 (e.g. 'qwen3-vl:30b' → 'Qwen3-VL 30B') */
  static formatDisplayName(modelName: string): string {
    const [name, tag] = modelName.split(':');
    const formattedName = name
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('-');
    const formattedTag = tag
      ? tag.replace(/(\d+)([a-z]+)/i, (_m, num, unit) => `${num}${unit.toUpperCase()}`)
          .replace(/^latest$/i, 'Latest')
      : '';
    return formattedTag ? `${formattedName} ${formattedTag}` : formattedName;
  }

  /** 获取 Ollama 可用的所有模型 */
  static async listModels(endpoint = 'http://localhost:11434'): Promise<OllamaModelDetails[]> {
    try {
      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API 错误 (${response.status})`);
      }

      const data = await response.json() as { models: OllamaModelDetails[] };
      return data.models || [];
    } catch (error) {
      throw new LlmError(
        LlmErrorType.NETWORK_ERROR,
        `获取 Ollama 模型列表失败: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }
}
