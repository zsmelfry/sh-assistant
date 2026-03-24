import { BaseLlmProvider } from './base-provider';
import type { ChatMessage, ChatOptions, ProviderType } from './types';
import { LlmError, LlmErrorType } from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/** Model mapping: short name → full model ID */
const MODEL_MAP: Record<string, string> = {
  'opus': 'claude-opus-4-20250514',
  'sonnet': 'claude-sonnet-4-20250514',
  'haiku': 'claude-haiku-4-5-20251001',
};

export type ClaudeApiModel = 'opus' | 'sonnet' | 'haiku';

export class ClaudeApiProvider extends BaseLlmProvider {
  constructor(
    private readonly model: ClaudeApiModel = 'haiku',
    private readonly apiKey: string,
  ) {
    super();
    if (!apiKey) {
      throw new LlmError(LlmErrorType.AUTH_ERROR, 'Claude API key is required');
    }
  }

  getType(): ProviderType {
    return 'claude-api';
  }

  getModelName(): string {
    return this.model;
  }

  private getFullModelId(): string {
    return MODEL_MAP[this.model] || this.model;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': API_VERSION,
    };
  }

  private buildBody(messages: ChatMessage[], options: Required<ChatOptions>, stream: boolean) {
    const system = messages.find(m => m.role === 'system');
    const conversation = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    // Ensure conversation starts with a user message
    if (conversation.length === 0 || conversation[0].role !== 'user') {
      conversation.unshift({ role: 'user', content: '...' });
    }

    const body: Record<string, unknown> = {
      model: this.getFullModelId(),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages: conversation,
      stream,
    };

    if (system) {
      body.system = system.content;
    }

    return body;
  }

  protected async _checkAvailability(): Promise<boolean> {
    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.getFullModelId(),
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      // 200 or 429 (rate limited) both mean the API is reachable and key is valid
      return res.status === 200 || res.status === 429;
    } catch {
      return false;
    }
  }

  protected async _chat(
    messages: ChatMessage[],
    options: Required<ChatOptions>,
  ): Promise<string> {
    const body = this.buildBody(messages, options, false);

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeout),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      this.throwApiError(res.status, errorBody);
    }

    const data = await res.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const text = data.content
      ?.filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!text) {
      throw new LlmError(LlmErrorType.INVALID_RESPONSE, 'Claude API returned empty response');
    }

    return text;
  }

  protected async *_chatStream(
    messages: ChatMessage[],
    options: Required<ChatOptions>,
  ): AsyncIterable<string> {
    const body = this.buildBody(messages, options, true);

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeout),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      this.throwApiError(res.status, errorBody);
    }

    if (!res.body) {
      throw new LlmError(LlmErrorType.INVALID_RESPONSE, 'No response body for streaming');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') return;

          try {
            const event = JSON.parse(json) as {
              type: string;
              delta?: { type: string; text?: string };
            };
            if (event.type === 'content_block_delta' && event.delta?.text) {
              yield event.delta.text;
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private throwApiError(status: number, body: string): never {
    let message = `Claude API error ${status}`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch { /* use default message */ }

    if (status === 401) {
      throw new LlmError(LlmErrorType.AUTH_ERROR, `API key 无效: ${message}`);
    }
    if (status === 429) {
      throw new LlmError(LlmErrorType.RATE_LIMIT, `请求频率超限: ${message}`);
    }
    throw new LlmError(LlmErrorType.INVALID_RESPONSE, `Claude API 调用失败: ${message}`);
  }
}
