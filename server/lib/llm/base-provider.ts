import type { ILlmProvider, ChatMessage, ChatOptions, ProviderType } from './types';
import { LlmError, LlmErrorType } from './types';

export abstract class BaseLlmProvider implements ILlmProvider {
  protected readonly defaultTimeout = 30000;
  protected readonly defaultMaxTokens = 2000;
  protected readonly defaultTemperature = 0.7;

  abstract getType(): ProviderType;
  abstract getModelName(): string;

  protected abstract _checkAvailability(): Promise<boolean>;
  protected abstract _chat(
    messages: ChatMessage[],
    options: Required<ChatOptions>,
  ): Promise<string>;

  async isAvailable(): Promise<boolean> {
    try {
      return await this._checkAvailability();
    } catch {
      return false;
    }
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const opts = this.normalizeOptions(options);

    try {
      return await this.withTimeout(
        this._chat(messages, opts),
        opts.timeout,
      );
    } catch (error) {
      if (error instanceof LlmError) throw error;
      throw new LlmError(
        LlmErrorType.INVALID_RESPONSE,
        `聊天失败: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /** 将 messages 数组格式化为单个 prompt 字符串 */
  protected formatMessages(messages: ChatMessage[]): string {
    const system = messages.find(m => m.role === 'system');
    const conversation = messages.filter(m => m.role !== 'system');

    let prompt = system ? `${system.content}\n\n` : '';
    if (conversation.length > 0) {
      prompt += conversation
        .map(m => `${m.role === 'user' ? '用户' : '助手'}：${m.content}`)
        .join('\n');
    }
    return prompt;
  }

  /** 解析 JSON 响应（容错处理） */
  protected parseJsonResponse(text: string): unknown {
    const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new LlmError(
        LlmErrorType.INVALID_RESPONSE,
        `响应中未找到 JSON: ${text.slice(0, 200)}`,
      );
    }
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new LlmError(
        LlmErrorType.INVALID_RESPONSE,
        `JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  protected normalizeOptions(options?: ChatOptions): Required<ChatOptions> {
    return {
      temperature: options?.temperature ?? this.defaultTemperature,
      maxTokens: options?.maxTokens ?? this.defaultMaxTokens,
      timeout: options?.timeout ?? this.defaultTimeout,
    };
  }

  protected withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new LlmError(LlmErrorType.TIMEOUT, `操作超时 (${timeoutMs}ms)`)),
          timeoutMs,
        );
      }),
    ]).finally(() => {
      clearTimeout(timer);
    });
  }
}
