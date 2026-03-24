import { OllamaProvider, GeminiProvider } from '../../lib/llm';

export default defineEventHandler(async () => {
  // Claude 模型（固定列表，总是可用）
  const claudeModels = [
    { provider: 'claude', modelName: 'haiku', displayName: 'Claude Haiku 4.5', available: true },
    { provider: 'claude', modelName: 'sonnet', displayName: 'Claude Sonnet 4.5', available: true },
    { provider: 'claude', modelName: 'opus', displayName: 'Claude Opus 4.6', available: true },
  ];

  // Gemini 模型（固定列表，免费可用）
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
    models: [...claudeModels, ...geminiModels, ...ollamaModels],
  };
});
