import type { ILlmProvider } from './types';
import { LlmError, LlmErrorType } from './types';
import { ClaudeProvider } from './claude-provider';
import type { ClaudeModel } from './claude-provider';
import { OllamaProvider } from './ollama-provider';
import type { LlmProvider } from '../../database/schemas/llm';

export class ProviderFactory {
  /** 从数据库配置创建 Provider 实例 */
  static fromDbConfig(config: LlmProvider): ILlmProvider {
    switch (config.provider) {
      case 'claude':
        return new ClaudeProvider(config.modelName as ClaudeModel);
      case 'ollama':
        return new OllamaProvider(config.modelName, config.endpoint || 'http://localhost:11434');
      default:
        throw new LlmError(
          LlmErrorType.PROVIDER_UNAVAILABLE,
          `未支持的 provider 类型: ${config.provider}`,
        );
    }
  }
}
