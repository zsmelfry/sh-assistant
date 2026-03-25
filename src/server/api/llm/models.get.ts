import { OllamaProvider, GeminiProvider } from '../../lib/llm';

export default defineEventHandler(async () => {
  // Claude API 模型
  const claudeApiModels = [
    { provider: 'claude-api', modelName: 'claude-opus-4-6', displayName: 'Claude Opus 4.6', available: true },
    { provider: 'claude-api', modelName: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', available: true },
    { provider: 'claude-api', modelName: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5', available: true },
  ];

  // Claude CLI 模型
  const claudeCliModels = [
    { provider: 'claude', modelName: 'opus', displayName: 'Claude Opus (CLI)', available: true },
    { provider: 'claude', modelName: 'sonnet', displayName: 'Claude Sonnet (CLI)', available: true },
  ];

  // Gemini 模型
  const geminiModels = GeminiProvider.listModels().map(m => ({
    provider: 'gemini',
    modelName: m.name,
    displayName: m.displayName,
    available: true,
  }));

  // Ollama 模型（动态发现）
  let ollamaModels: Array<{ provider: string; modelName: string; displayName: string; available: boolean; size?: number }> = [];
  try {
    const models = await OllamaProvider.listModels();
    ollamaModels = models.map(m => ({
      provider: 'ollama',
      modelName: m.name,
      displayName: OllamaProvider.formatDisplayName(m.name),
      available: true,
      size: m.size,
    }));
  } catch {
    // Ollama 不可用时静默忽略
  }

  return {
    models: [...claudeApiModels, ...claudeCliModels, ...geminiModels, ...ollamaModels],
  };
});
