import { BaseLlmProvider } from './base-provider';
import type { ChatMessage, ChatOptions, ProviderType } from './types';
import { LlmError, LlmErrorType } from './types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Free-tier models (use stable IDs, not preview suffixes) */
const MODEL_MAP: Record<string, string> = {
  '2.5-flash': 'gemini-2.5-flash',
  '2.5-flash-lite': 'gemini-2.5-flash-lite',
};

export type GeminiModel = keyof typeof MODEL_MAP;

/** Gemini API request types */
interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

export class GeminiProvider extends BaseLlmProvider {
  constructor(
    private readonly model: string = '2.5-flash',
    private readonly apiKey: string,
  ) {
    super();
    if (!apiKey) {
      throw new LlmError(LlmErrorType.AUTH_ERROR, 'Gemini API key is required');
    }
  }

  getType(): ProviderType {
    return 'gemini';
  }

  getModelName(): string {
    return this.model;
  }

  private getFullModelId(): string {
    return MODEL_MAP[this.model] || this.model;
  }

  /** Convert ChatMessage[] to Gemini format, handling system messages and consecutive same-role turns */
  private buildRequest(messages: ChatMessage[], options: Required<ChatOptions>): GeminiRequest {
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversation = messages.filter(m => m.role !== 'system');

    // Merge consecutive same-role messages and map roles
    const contents: GeminiContent[] = [];
    for (const msg of conversation) {
      const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
      const last = contents[contents.length - 1];
      if (last && last.role === geminiRole) {
        // Merge with previous message of same role
        last.parts[0].text += '\n' + msg.content;
      } else {
        contents.push({ role: geminiRole, parts: [{ text: msg.content }] });
      }
    }

    // Gemini requires conversation to start with 'user'
    if (contents.length === 0 || contents[0].role !== 'user') {
      contents.unshift({ role: 'user', parts: [{ text: '...' }] });
    }

    const request: GeminiRequest = {
      contents,
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      },
    };

    if (systemMessages.length > 0) {
      request.systemInstruction = {
        parts: [{ text: systemMessages.map(m => m.content).join('\n') }],
      };
    }

    return request;
  }

  private getUrl(action: string): string {
    return `${GEMINI_API_BASE}/${this.getFullModelId()}:${action}?key=${this.apiKey}`;
  }

  protected async _checkAvailability(): Promise<boolean> {
    try {
      const res = await fetch(this.getUrl('generateContent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
        signal: AbortSignal.timeout(10000),
      });
      return res.status === 200 || res.status === 429;
    } catch {
      return false;
    }
  }

  protected async _chat(
    messages: ChatMessage[],
    options: Required<ChatOptions>,
  ): Promise<string> {
    const request = this.buildRequest(messages, options);

    const res = await fetch(this.getUrl('generateContent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(options.timeout),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      this.throwApiError(res.status, errorBody);
    }

    const data = await res.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      throw new LlmError(LlmErrorType.INVALID_RESPONSE, 'Gemini 因内容安全策略拒绝了该请求');
    }

    const text = candidate?.content?.parts?.map(p => p.text).join('') || '';
    if (!text) {
      throw new LlmError(LlmErrorType.INVALID_RESPONSE, 'Gemini API 返回了空响应');
    }

    return text;
  }

  protected async *_chatStream(
    messages: ChatMessage[],
    options: Required<ChatOptions>,
  ): AsyncIterable<string> {
    const request = this.buildRequest(messages, options);

    const res = await fetch(this.getUrl('streamGenerateContent') + '&alt=sse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
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
          if (!json || json === '[DONE]') continue;

          try {
            const event = JSON.parse(json) as {
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
                finishReason?: string;
              }>;
            };
            const text = event.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield text;
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
    let message = `Gemini API error ${status}`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch { /* use default message */ }

    if (status === 400) {
      throw new LlmError(LlmErrorType.INVALID_RESPONSE, `请求无效: ${message}`);
    }
    if (status === 403) {
      throw new LlmError(LlmErrorType.AUTH_ERROR, `API key 无效或权限不足: ${message}`);
    }
    if (status === 404) {
      throw new LlmError(LlmErrorType.MODEL_NOT_FOUND, `模型不存在: ${message}`);
    }
    if (status === 429) {
      throw new LlmError(LlmErrorType.RATE_LIMIT, `请求频率超限 (免费额度: 10次/分钟, 250次/天): ${message}`);
    }
    throw new LlmError(LlmErrorType.INVALID_RESPONSE, `Gemini API 调用失败: ${message}`);
  }

  /** Static model list for discovery */
  static listModels(): Array<{ name: string; displayName: string }> {
    return [
      { name: '2.5-flash', displayName: 'Gemini 2.5 Flash' },
      { name: '2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite' },
    ];
  }
}
