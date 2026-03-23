import type { ILlmProvider } from './types';
import { LlmError, LlmErrorType } from './types';
import { ClaudeProvider } from './claude-provider';
import type { ClaudeModel } from './claude-provider';
import { ClaudeApiProvider } from './claude-api-provider';
import type { ClaudeApiModel } from './claude-api-provider';
import { GeminiProvider } from './gemini-provider';
import { OllamaProvider } from './ollama-provider';
import type { LlmProvider } from '../../database/schemas/llm';

export class ProviderFactory {
  /** 从数据库配置创建 Provider 实例 */
  static fromDbConfig(config: LlmProvider): ILlmProvider {
    switch (config.provider) {
      case 'claude':
        return new ClaudeProvider(config.modelName as ClaudeModel);
      case 'claude-api':
        if (!config.apiKey) {
          throw new LlmError(LlmErrorType.AUTH_ERROR, 'Claude API provider 需要配置 API key');
        }
        return new ClaudeApiProvider(config.modelName as ClaudeApiModel, config.apiKey);
      case 'ollama':
        return new OllamaProvider(config.modelName, config.endpoint || 'http://localhost:11434');
      case 'gemini':
        if (!config.apiKey) {
          throw new LlmError(LlmErrorType.AUTH_ERROR, 'Gemini provider 需要配置 API key');
        }
        return new GeminiProvider(config.modelName, config.apiKey);
      default:
        throw new LlmError(
          LlmErrorType.PROVIDER_UNAVAILABLE,
          `未支持的 provider 类型: ${config.provider}`,
        );
    }
  }
}
