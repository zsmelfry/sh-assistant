// ===== 平台级 LLM Composable =====
// 任何工具可通过 useLlm() 调用 LLM（Nuxt 自动导入）

// ===== Types =====

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  providerId?: number;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface ChatResponse {
  content: string;
  meta: {
    provider: string;
    modelName: string;
    timestamp: string;
  };
}

export interface TranslateResponse {
  definition: string;
  partOfSpeech: string;
  examples: Array<{ sentence: string; translation: string }>;
  synonyms: string;
  antonyms: string;
  wordFamily: string;
  collocations: string;
  meta: {
    provider: string;
    modelName: string;
    timestamp: string;
  };
}

export interface LlmProvider {
  id: number;
  provider: string;
  name: string;
  modelName: string;
  endpoint: string | null;
  apiKey: string | null;
  isDefault: boolean;
  isEnabled: boolean;
  params: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateProviderRequest {
  provider: 'claude' | 'ollama' | 'openai';
  name: string;
  modelName: string;
  endpoint?: string;
  apiKey?: string;
  params?: string;
}

export interface ModelInfo {
  provider: string;
  modelName: string;
  displayName: string;
  available: boolean;
  size?: number;
}

// ===== Composable =====

export function useLlm() {
  const providers = ref<LlmProvider[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const defaultProvider = computed(() =>
    providers.value.find(p => p.isDefault),
  );

  function extractErrorMessage(e: unknown, fallback: string): string {
    return (e as { data?: { message?: string } })?.data?.message
      || (e instanceof Error ? e.message : fallback);
  }

  function buildOptionsBody(options?: ChatOptions): Record<string, unknown> {
    return {
      providerId: options?.providerId,
      options: {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        timeout: options?.timeout,
      },
    };
  }

  async function withLoading<T>(fn: () => Promise<T>, fallbackError: string): Promise<T> {
    loading.value = true;
    error.value = null;
    try {
      return await fn();
    } catch (e: unknown) {
      error.value = extractErrorMessage(e, fallbackError);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return withLoading(
      () => $fetch<ChatResponse>('/api/llm/chat', {
        method: 'POST',
        body: { messages, ...buildOptionsBody(options) },
      }),
      '聊天请求失败',
    );
  }

  function translate(word: string, options?: ChatOptions): Promise<TranslateResponse> {
    return withLoading(
      () => $fetch<TranslateResponse>('/api/llm/translate', {
        method: 'POST',
        body: { word, ...buildOptionsBody(options) },
      }),
      '翻译请求失败',
    );
  }

  async function loadProviders(): Promise<void> {
    providers.value = await $fetch<LlmProvider[]>('/api/llm/providers');
  }

  async function addProvider(data: CreateProviderRequest): Promise<LlmProvider> {
    const result = await $fetch<LlmProvider>('/api/llm/providers', {
      method: 'POST',
      body: data,
    });
    await loadProviders();
    return result;
  }

  async function updateProvider(
    id: number,
    data: Partial<CreateProviderRequest> & { isEnabled?: boolean },
  ): Promise<LlmProvider> {
    const result = await $fetch<LlmProvider>(`/api/llm/providers/${id}`, {
      method: 'PUT',
      body: data,
    });
    await loadProviders();
    return result;
  }

  async function deleteProvider(id: number): Promise<void> {
    await $fetch(`/api/llm/providers/${id}`, { method: 'DELETE' });
    await loadProviders();
  }

  async function setDefault(id: number): Promise<void> {
    await $fetch(`/api/llm/providers/${id}/default`, { method: 'POST' });
    await loadProviders();
  }

  async function discoverModels(): Promise<ModelInfo[]> {
    const data = await $fetch<{ models: ModelInfo[] }>('/api/llm/models');
    return data.models;
  }

  return {
    chat,
    translate,
    providers,
    defaultProvider,
    loadProviders,
    addProvider,
    updateProvider,
    deleteProvider,
    setDefault,
    discoverModels,
    loading,
    error,
  };
}
