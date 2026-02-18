# 平台级 LLM 集成架构设计

> 版本: v1.0
> 日期: 2026-02-18
> 作者: 小M (架构师)
> 状态: 待评审
> 前置文档: ARCHITECTURE.md, PLUGIN-ARCHITECTURE-ANALYSIS.md
> 参考实现: french-words/lib/llm-providers/, french-words/server/translate-proxy.ts

---

## 1. 设计目标

**核心原则：LLM 模块是平台级基础设施，不属于任何工具。**

| 目标 | 说明 |
|------|------|
| 平台级 | 任何工具（vocab-tracker、habit-tracker、未来工具）均可调用 LLM |
| Provider 透明 | 工具层不关心底层使用 Claude/Ollama/OpenAI，只传入 prompt + messages |
| 零改动接入 | 新工具使用 LLM 只需 `const { chat } = useLlm()`，无需修改平台代码 |
| 缓存自治 | 平台提供通用 LLM 调用，缓存策略由各工具自行管理 |
| 从 french-words 迁移 | 复用已验证的 Provider 抽象层，从独立 HTTP 服务器迁移到 Nitro API 路由 |

---

## 2. 架构总览

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                       浏览器 (Vue 3 SPA)                         │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ vocab-tracker     │  │ habit-tracker     │  │ future-tool   │  │
│  │                   │  │                   │  │               │  │
│  │ useLlm().chat()  │  │ useLlm().chat()  │  │ useLlm().*   │  │
│  │ useLlm()         │  │                   │  │               │  │
│  │   .translate()   │  │ (暂不用 LLM)      │  │               │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬────────┘  │
│           │                      │                    │           │
│  ┌────────┴──────────────────────┴────────────────────┴────────┐ │
│  │                    composables/useLlm.ts                     │ │
│  │              平台级 LLM composable（自动导入）                  │ │
│  │                                                              │ │
│  │  chat(system, messages, opts?)  → string                     │ │
│  │  translate(word, opts?)         → TranslationResult          │ │
│  │  getProviders()                 → LlmProvider[]              │ │
│  │  getDefaultProvider()           → LlmProvider                │ │
│  └──────────────────────┬───────────────────────────────────────┘ │
│                          │ $fetch                                  │
├──────────────────────────┼────────────────────────────────────────┤
│                     Nitro Server                                   │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                  server/api/llm/                              │  │
│  │                                                              │  │
│  │  POST /api/llm/chat          ← 通用聊天（system + messages）  │  │
│  │  POST /api/llm/translate     ← 翻译/释义（word + opts）      │  │
│  │  GET  /api/llm/providers     ← 获取所有 Provider             │  │
│  │  POST /api/llm/providers     ← 添加 Provider                │  │
│  │  PUT  /api/llm/providers/:id ← 更新 Provider                │  │
│  │  DELETE /api/llm/providers/:id ← 删除 Provider              │  │
│  │  POST /api/llm/providers/:id/default ← 设为默认             │  │
│  │  GET  /api/llm/models        ← 自动发现可用模型              │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                          │                                          │
│  ┌───────────────────────┴──────────────────────────────────────┐  │
│  │              server/lib/llm/                                   │  │
│  │         (从 french-words/lib/llm-providers/ 迁移)              │  │
│  │                                                                │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │ BaseLlm     │  │ ClaudeLlm    │  │ OllamaLlm         │   │  │
│  │  │ Provider    │←─│ Provider     │  │ Provider           │   │  │
│  │  └─────────────┘  └──────────────┘  └───────────────────┘   │  │
│  │                                                                │  │
│  │  ┌─────────────────┐  ┌──────────────────────────────────┐   │  │
│  │  │ ProviderFactory │  │ types.ts (接口 + 错误类型)        │   │  │
│  │  └─────────────────┘  └──────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                          │                                          │
│  ┌───────────────────────┴──────────────────────────────────────┐  │
│  │              server/database/schemas/llm.ts                    │  │
│  │              llm_providers 表                                  │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │                                          │
│  ┌───────────────────────┴──────────────────────────────────────┐  │
│  │                     SQLite (.db)                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌────────────┐ ┌───────────┐ ┌────────────┐
     │ Claude CLI │ │ Ollama    │ │ OpenAI API │
     │ (本地)     │ │ (本地)    │ │ (远程)     │
     └────────────┘ └───────────┘ └────────────┘
```

### 2.2 与原 french-words 实现的对比

| 维度 | french-words (原) | 个人助手 (新) |
|------|------------------|-------------|
| 后端 | 独立 HTTP 服务器 (`translate-proxy.ts`) | Nitro API 路由 (`server/api/llm/`) |
| Provider 存储 | IndexedDB (Dexie) | SQLite (Drizzle ORM) |
| Provider 管理 | 前端 Service (`llmProviderService.ts`) | 后端 API + 前端 composable |
| 作用域 | 仅服务法语词汇 | 平台级，任何工具可用 |
| Provider 抽象 | `lib/llm-providers/` | `server/lib/llm/` (迁移+简化) |
| 聊天接口 | 绑定单词上下文 | 通用 system prompt + messages |
| 翻译接口 | 硬编码法语→中文 | 保持法语→中文（vocab-tracker 专用 prompt 由工具传入） |

---

## 3. 数据库设计

### 3.1 llm_providers 表

```typescript
// server/database/schemas/llm.ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const llmProviders = sqliteTable('llm_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull(),          // 'claude' | 'ollama' | 'openai'
  name: text('name').notNull(),                  // 显示名称: 'Claude Haiku 4.5'
  modelName: text('model_name').notNull(),       // 模型标识: 'haiku', 'qwen3:30b'
  endpoint: text('endpoint'),                    // Ollama/OpenAI 端点 URL
  apiKey: text('api_key'),                       // OpenAI API key（加密存储）
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  params: text('params').default('{}'),          // JSON: { temperature, maxTokens }
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_llm_providers_provider').on(table.provider),
  index('idx_llm_providers_is_default').on(table.isDefault),
]);

// 类型推导
export type LlmProvider = typeof llmProviders.$inferSelect;
export type NewLlmProvider = typeof llmProviders.$inferInsert;
```

### 3.2 Schema 聚合

```typescript
// server/database/schema.ts（添加一行）
export * from './schemas/habits';
export * from './schemas/vocab';
export * from './schemas/llm';    // 新增
```

### 3.3 缓存策略说明

**平台层不提供通用 LLM 缓存表。** 原因：

1. 不同工具的缓存粒度不同：
   - vocab-tracker: 按 `wordId` 缓存释义（已有 `definitions` 表设计）
   - 未来聊天工具: 可能按 `sessionId` 缓存对话
   - 习惯分析: 可能按 `habitId + month` 缓存分析结果

2. 缓存键和失效策略因工具而异，强制统一会增加复杂度

3. **建议模式**: 各工具在自己的数据表中存储 LLM 结果，平台只负责调用

---

## 4. 后端 Provider 抽象层

### 4.1 文件结构

```
server/lib/llm/
  ├── types.ts              # 接口定义 + 错误类型
  ├── base-provider.ts      # 抽象基类（超时、重试、JSON 解析）
  ├── claude-provider.ts    # Claude CLI 实现
  ├── ollama-provider.ts    # Ollama HTTP API 实现
  ├── provider-factory.ts   # 工厂（从 DB 配置创建实例）
  └── index.ts              # 聚合导出
```

### 4.2 核心接口

```typescript
// server/lib/llm/types.ts

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

/** Provider 健康状态 */
export interface HealthStatus {
  available: boolean;
  latency?: number;
  error?: string;
}

/** LLM Provider 接口（简化版，通用化） */
export interface ILlmProvider {
  /** 获取 provider 类型 */
  getType(): ProviderType;

  /** 获取模型名 */
  getModelName(): string;

  /** 检查是否可用 */
  isAvailable(): Promise<boolean>;

  /** 通用聊天（接收 system prompt + messages） */
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
```

### 4.3 关键设计变化（vs french-words）

| french-words 原实现 | 新设计 | 理由 |
|---------------------|--------|------|
| `translate(word)` 硬编码法语翻译 | 统一为 `chat(messages)` | 翻译 = 特定 system prompt 的聊天，工具自行构建 prompt |
| `chat(word, messages)` 绑定单词 | `chat(messages)` 通用 | 上下文由调用方通过 system message 注入 |
| Provider 接口有 `translate` + `chat` 两个方法 | 只有 `chat` | 减少接口面积；翻译端点在 API 层用 prompt 模板实现 |
| `buildTranslatePrompt()` 在 provider 层 | prompt 由 API 路由或工具提供 | 保持 provider 层纯粹（只管调 LLM），prompt 策略归属调用方 |

### 4.4 Provider 实现概要

#### ClaudeProvider

```typescript
// server/lib/llm/claude-provider.ts
// 核心: 通过 child_process.spawn 调用 `claude` CLI
// 输入: messages 数组 → 拼接为单个 prompt
// 输出: CLI stdout → 解析为文本

export class ClaudeProvider extends BaseLlmProvider {
  constructor(private model: 'opus' | 'sonnet' | 'haiku') { super(); }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const prompt = this.formatMessages(messages);
    const stdout = await this.execClaude(
      ['-p', '-', '--model', this.model, '--output-format', 'text'],
      prompt,
      options?.timeout ?? 30000,
    );
    return stdout.trim();
  }

  // 将 messages 数组拼接为单个 prompt 字符串
  private formatMessages(messages: ChatMessage[]): string {
    const system = messages.find(m => m.role === 'system');
    const conversation = messages.filter(m => m.role !== 'system');
    let prompt = system ? `${system.content}\n\n` : '';
    prompt += conversation
      .map(m => `${m.role === 'user' ? '用户' : '助手'}：${m.content}`)
      .join('\n');
    return prompt;
  }

  // spawn claude CLI（复用 french-words 已验证的实现）
  private execClaude(args: string[], stdin: string, timeout: number): Promise<string> {
    // ...同 french-words/lib/llm-providers/claude-provider.ts
  }
}
```

#### OllamaProvider

```typescript
// server/lib/llm/ollama-provider.ts
// 核心: 通过 Ollama HTTP API (/api/generate) 调用本地模型
// 复用 french-words 已验证的实现，简化为通用 chat 接口

export class OllamaProvider extends BaseLlmProvider {
  constructor(private modelName: string, private endpoint: string) { super(); }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const prompt = this.formatMessages(messages);
    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelName,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 2000,
        },
      }),
      signal: AbortSignal.timeout(options?.timeout ?? 30000),
    });
    const data = await response.json();
    return data.response.trim();
  }

  static async listModels(endpoint: string): Promise<string[]> {
    // 调用 /api/tags 获取本地模型列表
  }
}
```

### 4.5 ProviderFactory

```typescript
// server/lib/llm/provider-factory.ts

import type { LlmProvider } from '~/server/database/schemas/llm';

export class ProviderFactory {
  /** 从数据库配置创建 Provider 实例 */
  static fromDbConfig(config: LlmProvider): ILlmProvider {
    switch (config.provider) {
      case 'claude':
        return new ClaudeProvider(config.modelName as 'opus' | 'sonnet' | 'haiku');
      case 'ollama':
        return new OllamaProvider(config.modelName, config.endpoint || 'http://localhost:11434');
      default:
        throw new LlmError(LlmErrorType.PROVIDER_UNAVAILABLE, `未知 provider: ${config.provider}`);
    }
  }
}
```

---

## 5. API 路由设计

### 5.1 路由总览

```
server/api/llm/
  ├── chat.post.ts                  # POST /api/llm/chat
  ├── translate.post.ts             # POST /api/llm/translate
  ├── models.get.ts                 # GET  /api/llm/models
  └── providers/
      ├── index.get.ts              # GET  /api/llm/providers
      ├── index.post.ts             # POST /api/llm/providers
      ├── [id].put.ts               # PUT  /api/llm/providers/:id
      ├── [id].delete.ts            # DELETE /api/llm/providers/:id
      └── [id].default.post.ts      # POST /api/llm/providers/:id/default
```

### 5.2 POST /api/llm/chat — 通用聊天

**这是平台级核心端点。** 任何工具通过此端点与 LLM 对话。

```typescript
// 请求体
interface ChatRequest {
  messages: ChatMessage[];          // system + user + assistant 消息
  providerId?: number;              // 指定 provider（可选，默认使用 default）
  options?: {
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
  };
}

// 响应
interface ChatSuccessResponse {
  content: string;                  // LLM 回复内容
  meta: {
    provider: string;               // 'claude' | 'ollama'
    modelName: string;              // 'haiku' | 'qwen3:30b'
    timestamp: string;              // ISO 时间戳
  };
}

// 错误响应
interface ChatErrorResponse {
  error: string;
  type?: LlmErrorType;
}
```

**实现伪代码**:

```typescript
// server/api/llm/chat.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // 校验 messages
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw createError({ statusCode: 400, message: '缺少 messages' });
  }

  // 获取 provider 配置
  const db = useDB();
  let providerConfig: LlmProvider;

  if (body.providerId) {
    providerConfig = await db.select()...where(eq(llmProviders.id, body.providerId));
  } else {
    providerConfig = await db.select()...where(eq(llmProviders.isDefault, true));
  }

  if (!providerConfig) {
    throw createError({ statusCode: 400, message: '未配置 LLM Provider' });
  }

  // 创建 provider 实例并调用
  const provider = ProviderFactory.fromDbConfig(providerConfig);
  const content = await provider.chat(body.messages, body.options);

  return {
    content,
    meta: {
      provider: providerConfig.provider,
      modelName: providerConfig.modelName,
      timestamp: new Date().toISOString(),
    },
  };
});
```

### 5.3 POST /api/llm/translate — 翻译/释义

**封装翻译专用 prompt 的便捷端点。** 本质上是 `/api/llm/chat` 的快捷方式。

```typescript
// 请求体
interface TranslateRequest {
  word: string;                     // 法语单词
  providerId?: number;              // 指定 provider
  options?: {
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
  };
}

// 响应（与 french-words 兼容）
interface TranslateResponse {
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
```

**实现逻辑**:

```typescript
// server/api/llm/translate.post.ts
export default defineEventHandler(async (event) => {
  const { word, providerId, options } = await readBody(event);

  if (!word?.trim()) {
    throw createError({ statusCode: 400, message: '缺少 word 参数' });
  }

  // 构建翻译 prompt（平台提供默认模板，vocab-tracker 也可自行调 /chat）
  const systemPrompt = buildTranslateSystemPrompt();
  const userMessage = buildTranslateUserMessage(word);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // 复用 chat 逻辑获取原始响应
  const provider = await resolveProvider(providerId);
  const rawContent = await provider.chat(messages, {
    ...options,
    // 翻译需要 JSON 输出，温度低一些
    temperature: options?.temperature ?? 0.5,
  });

  // 解析 JSON 响应
  const parsed = parseTranslationJson(rawContent);

  return {
    ...parsed,
    meta: {
      provider: provider.getType(),
      modelName: provider.getModelName(),
      timestamp: new Date().toISOString(),
    },
  };
});
```

### 5.4 GET /api/llm/providers — 获取所有 Provider

```typescript
// 响应
type ProvidersResponse = LlmProvider[];  // 不返回 apiKey 字段（安全）
```

### 5.5 POST /api/llm/providers — 添加 Provider

```typescript
// 请求体
interface CreateProviderRequest {
  provider: 'claude' | 'ollama' | 'openai';
  name: string;
  modelName: string;
  endpoint?: string;
  apiKey?: string;
  params?: string;                  // JSON 字符串
}

// 响应: 201 Created
type CreateProviderResponse = LlmProvider;
```

### 5.6 POST /api/llm/providers/:id/default — 设为默认

```typescript
// 无请求体
// 响应: 200 OK
// 效果: 将指定 provider 设为默认，清除其他 provider 的 isDefault
```

### 5.7 GET /api/llm/models — 自动发现可用模型

```typescript
// 响应
interface ModelsResponse {
  models: Array<{
    provider: string;
    modelName: string;
    displayName: string;
    available: boolean;
    size?: number;                  // Ollama 模型大小
  }>;
}
```

**实现**: 合并 Claude 固定模型列表 + Ollama `/api/tags` 动态发现。

---

## 6. 前端 Composable

### 6.1 useLlm — 平台级 LLM composable

```typescript
// composables/useLlm.ts

export interface UseLlmReturn {
  // ===== 核心调用 =====

  /** 通用聊天 — 传入 system prompt + messages */
  chat: (
    messages: ChatMessage[],
    options?: ChatRequestOptions,
  ) => Promise<ChatResponse>;

  /** 翻译 — 传入法语单词 */
  translate: (
    word: string,
    options?: TranslateRequestOptions,
  ) => Promise<TranslateResponse>;

  // ===== Provider 管理 =====

  /** 获取所有 provider */
  providers: Ref<LlmProvider[]>;

  /** 默认 provider */
  defaultProvider: ComputedRef<LlmProvider | undefined>;

  /** 加载 provider 列表 */
  loadProviders: () => Promise<void>;

  /** 添加 provider */
  addProvider: (data: CreateProviderRequest) => Promise<LlmProvider>;

  /** 删除 provider */
  deleteProvider: (id: number) => Promise<void>;

  /** 设为默认 */
  setDefault: (id: number) => Promise<void>;

  /** 发现可用模型（Ollama 等） */
  discoverModels: () => Promise<ModelInfo[]>;

  // ===== 状态 =====

  /** 是否正在调用 LLM */
  loading: Ref<boolean>;

  /** 最近一次错误 */
  error: Ref<string | null>;
}
```

### 6.2 使用示例

#### vocab-tracker 获取释义

```typescript
// tools/vocab-tracker/composables/useDefinition.ts
export function useDefinition() {
  const { translate } = useLlm();

  async function fetchDefinition(word: string) {
    const result = await translate(word);
    // 缓存到 vocab 专属的 definitions 表
    await $fetch('/api/vocab/definitions', {
      method: 'POST',
      body: { wordId, ...result },
    });
    return result;
  }

  return { fetchDefinition };
}
```

#### vocab-tracker 聊天

```typescript
// tools/vocab-tracker/composables/useVocabChat.ts
export function useVocabChat(word: Ref<string>) {
  const { chat } = useLlm();
  const messages = ref<ChatMessage[]>([]);

  async function sendMessage(content: string) {
    messages.value.push({ role: 'user', content });

    const response = await chat([
      { role: 'system', content: `你是法语教学助手。用户正在学习单词 "${word.value}"。用中文简洁回答。` },
      ...messages.value,
    ]);

    messages.value.push({ role: 'assistant', content: response.content });
    return response;
  }

  return { messages, sendMessage };
}
```

#### 未来工具示例 — 习惯分析

```typescript
// tools/habit-tracker/composables/useHabitInsight.ts（假设未来需求）
export function useHabitInsight() {
  const { chat } = useLlm();

  async function analyzeHabit(habitName: string, stats: HabitStats) {
    const response = await chat([
      { role: 'system', content: '你是习惯养成教练。根据用户的打卡数据给出鼓励和建议。' },
      { role: 'user', content: `我的习惯"${habitName}"，本月完成率${stats.monthlyRate}%，连续${stats.streak}天。给我建议。` },
    ]);
    return response.content;
  }

  return { analyzeHabit };
}
```

### 6.3 useLlm 实现要点

```typescript
// composables/useLlm.ts
export function useLlm(): UseLlmReturn {
  const providers = ref<LlmProvider[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const defaultProvider = computed(() =>
    providers.value.find(p => p.isDefault)
  );

  async function chat(messages: ChatMessage[], options?: ChatRequestOptions) {
    loading.value = true;
    error.value = null;
    try {
      return await $fetch<ChatResponse>('/api/llm/chat', {
        method: 'POST',
        body: { messages, ...options },
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : '聊天请求失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function translate(word: string, options?: TranslateRequestOptions) {
    loading.value = true;
    error.value = null;
    try {
      return await $fetch<TranslateResponse>('/api/llm/translate', {
        method: 'POST',
        body: { word, ...options },
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : '翻译请求失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function loadProviders() {
    providers.value = await $fetch<LlmProvider[]>('/api/llm/providers');
  }

  async function addProvider(data: CreateProviderRequest) {
    const result = await $fetch<LlmProvider>('/api/llm/providers', {
      method: 'POST',
      body: data,
    });
    await loadProviders();
    return result;
  }

  async function deleteProvider(id: number) {
    await $fetch(`/api/llm/providers/${id}`, { method: 'DELETE' });
    await loadProviders();
  }

  async function setDefault(id: number) {
    await $fetch(`/api/llm/providers/${id}/default`, { method: 'POST' });
    await loadProviders();
  }

  async function discoverModels() {
    const data = await $fetch<{ models: ModelInfo[] }>('/api/llm/models');
    return data.models;
  }

  return {
    chat, translate,
    providers, defaultProvider, loadProviders,
    addProvider, deleteProvider, setDefault, discoverModels,
    loading, error,
  };
}
```

---

## 7. 前端组件设计

### 7.1 LLM Provider 设置面板

```
components/
  └── LlmSettings.vue              # 全局 LLM Provider 管理界面
```

**放置位置**: 侧边栏底部的齿轮图标 → 弹出设置面板（BaseModal）。

**功能**:
1. 显示已配置的 Provider 列表
2. 标记默认 Provider（星号）
3. 添加/编辑/删除 Provider
4. 一键发现 Ollama 本地模型
5. 测试 Provider 连接

**UI 草图**:

```
┌──────────────────────────────────────┐
│  LLM 模型设置                    [×]  │
├──────────────────────────────────────┤
│                                      │
│  默认模型: Claude Haiku 4.5     [▼]  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ★ Claude Haiku 4.5   claude    │  │
│  │   Claude Sonnet 4.5  claude    │  │
│  │   Qwen3 30B          ollama    │  │
│  └────────────────────────────────┘  │
│                                      │
│  [+ 添加]  [发现 Ollama 模型]        │
│                                      │
└──────────────────────────────────────┘
```

### 7.2 侧边栏集成

```vue
<!-- components/AppSidebar.vue — 底部添加设置入口 -->
<template>
  <nav class="sidebar">
    <!-- 工具列表 -->
    <div class="tool-list">...</div>

    <!-- 底部设置区 -->
    <div class="sidebar-footer">
      <button @click="showLlmSettings = true" class="settings-btn">
        <Settings :size="18" :stroke-width="1.5" />
      </button>
    </div>

    <LlmSettings v-if="showLlmSettings" @close="showLlmSettings = false" />
  </nav>
</template>
```

---

## 8. 数据流图

### 8.1 通用聊天流程

```
工具层 (e.g. vocab-tracker)
  │
  │  useLlm().chat([
  │    { role: 'system', content: '你是法语教学助手...' },
  │    { role: 'user', content: '请解释 bonjour' },
  │  ])
  │
  ▼
composables/useLlm.ts
  │  $fetch('/api/llm/chat', { method: 'POST', body: { messages } })
  │
  ▼
server/api/llm/chat.post.ts
  │  1. 从 DB 获取 default provider 配置
  │  2. ProviderFactory.fromDbConfig(config)
  │  3. provider.chat(messages, options)
  │
  ▼ (分支)
  ├─ ClaudeProvider
  │  spawn('claude', ['-p', '-', '--model', 'haiku']) → stdout
  │
  └─ OllamaProvider
     fetch('http://localhost:11434/api/generate', {...}) → response
  │
  ▼
server/api/llm/chat.post.ts
  │  返回 { content, meta: { provider, modelName, timestamp } }
  │
  ▼
composables/useLlm.ts
  │  返回 ChatResponse 给工具层
  │
  ▼
工具层
  │  使用 response.content 更新 UI
  │  （可选）缓存到工具自己的数据表
```

### 8.2 翻译流程（vocab-tracker 调用）

```
vocab-tracker: useDefinition()
  │
  │  1. 检查 definitions 表缓存
  │  2. 缓存未命中 → useLlm().translate(word)
  │
  ▼
composables/useLlm.ts
  │  $fetch('/api/llm/translate', { body: { word } })
  │
  ▼
server/api/llm/translate.post.ts
  │  1. 构建法语翻译 system prompt
  │  2. 调用 provider.chat(messages)
  │  3. 解析 JSON 响应
  │  4. 返回结构化 TranslateResponse
  │
  ▼
vocab-tracker: useDefinition()
  │  缓存 result → $fetch('/api/vocab/definitions', { method: 'POST', body: result })
```

### 8.3 Provider 管理流程

```
LlmSettings.vue
  │
  ├─ loadProviders() → GET /api/llm/providers → 显示列表
  │
  ├─ addProvider()   → POST /api/llm/providers → 刷新列表
  │
  ├─ setDefault(id)  → POST /api/llm/providers/:id/default → 刷新列表
  │
  └─ discoverModels() → GET /api/llm/models → 显示可添加的模型
```

---

## 9. 完整文件清单

### 9.1 新增文件

| 文件 | 层 | 说明 |
|------|---|------|
| `server/database/schemas/llm.ts` | DB | llm_providers 表定义 |
| `server/lib/llm/types.ts` | 后端 | 接口定义、错误类型 |
| `server/lib/llm/base-provider.ts` | 后端 | 抽象基类（超时、重试） |
| `server/lib/llm/claude-provider.ts` | 后端 | Claude CLI 实现 |
| `server/lib/llm/ollama-provider.ts` | 后端 | Ollama HTTP 实现 |
| `server/lib/llm/provider-factory.ts` | 后端 | 从 DB 配置创建实例 |
| `server/lib/llm/index.ts` | 后端 | 聚合导出 |
| `server/api/llm/chat.post.ts` | API | 通用聊天端点 |
| `server/api/llm/translate.post.ts` | API | 翻译端点 |
| `server/api/llm/models.get.ts` | API | 模型发现 |
| `server/api/llm/providers/index.get.ts` | API | 获取所有 provider |
| `server/api/llm/providers/index.post.ts` | API | 添加 provider |
| `server/api/llm/providers/[id].put.ts` | API | 更新 provider |
| `server/api/llm/providers/[id].delete.ts` | API | 删除 provider |
| `server/api/llm/providers/[id].default.post.ts` | API | 设为默认 |
| `composables/useLlm.ts` | 前端 | 平台级 composable |
| `components/LlmSettings.vue` | 前端 | Provider 管理界面 |

### 9.2 修改文件

| 文件 | 改动 |
|------|------|
| `server/database/schema.ts` | 添加 `export * from './schemas/llm'` (1 行) |
| `components/AppSidebar.vue` | 底部添加设置按钮入口 |

### 9.3 迁移来源映射

| 新文件 | 来源 | 变化 |
|--------|------|------|
| `server/lib/llm/types.ts` | `french-words/lib/llm-providers/types.ts` | 去除 translate 专用类型，简化为通用 chat |
| `server/lib/llm/base-provider.ts` | `french-words/lib/llm-providers/base-provider.ts` | 去除 translate 方法，保留超时/重试/JSON 解析 |
| `server/lib/llm/claude-provider.ts` | `french-words/lib/llm-providers/claude-provider.ts` | 去除 _translate，统一为 chat |
| `server/lib/llm/ollama-provider.ts` | `french-words/lib/llm-providers/ollama-provider.ts` | 同上 |
| `server/lib/llm/provider-factory.ts` | `french-words/lib/llm-providers/provider-factory.ts` | 改为从 DB 配置创建（不再缓存实例） |
| `server/api/llm/chat.post.ts` | `french-words/server/translate-proxy.ts` handleChat | Nitro 路由 + DB 读取 provider |
| `server/api/llm/translate.post.ts` | `french-words/server/translate-proxy.ts` handleTranslate | 内置翻译 prompt 模板 |
| `server/api/llm/models.get.ts` | `french-words/server/translate-proxy.ts` handleModels | 相同逻辑，Nitro 路由格式 |
| `composables/useLlm.ts` | `french-words/src/services/llmService.ts` + `chatService.ts` | 合并为单一 composable |
| `server/database/schemas/llm.ts` | `french-words llmProviders` (Dexie) | IndexedDB → Drizzle SQLite |

---

## 10. 扩展性设计

### 10.1 新工具接入 LLM — 零改动

新工具（如 `note-assistant`）使用 LLM 只需：

```typescript
// tools/note-assistant/composables/useNoteAI.ts
export function useNoteAI() {
  const { chat } = useLlm();  // 自动导入，零配置

  async function summarize(noteContent: string) {
    const response = await chat([
      { role: 'system', content: '你是笔记助手。请用中文总结以下内容。' },
      { role: 'user', content: noteContent },
    ]);
    return response.content;
  }

  return { summarize };
}
```

**无需修改任何平台文件。** `useLlm()` 由 Nuxt 自动导入。

### 10.2 新增 Provider — 两步

1. 在 `server/lib/llm/` 中新增 Provider 实现（如 `openai-provider.ts`）
2. 在 `provider-factory.ts` 的 switch 中添加一个 case

工具层和前端 composable 完全不需要修改。

### 10.3 自定义 Prompt 模板

工具通过 `chat()` 的 system message 完全控制 prompt。平台不限制 prompt 内容。

`/api/llm/translate` 只是一个便捷端点（预设法语翻译 prompt）。如果工具需要不同的翻译 prompt（如英语→中文），可以直接调用 `/api/llm/chat` 自行构建。

### 10.4 缓存策略指南

| 工具 | 缓存位置 | 缓存键 | 失效策略 |
|------|---------|--------|---------|
| vocab-tracker | `vocab_definitions` 表 | `wordId` | 手动重新生成 |
| 未来聊天记录 | 工具自己的 `chat_history` 表 | `sessionId` | 无（持久化） |
| 习惯分析 | 内存/组件 ref | 无 | 每次重新生成 |

---

## 11. 安全考量

| 场景 | 措施 |
|------|------|
| API Key 存储 | `apiKey` 字段存入 SQLite，GET /providers 返回时脱敏（只显示末 4 位） |
| API Key 传输 | 只在 POST/PUT 时接收，存入 DB 后仅在服务端使用，不回传前端 |
| 输入校验 | messages 数组非空校验；word 参数非空校验 |
| 超时保护 | 默认 30s 超时，防止 LLM 调用挂起 |
| Claude CLI 安全 | 通过 stdin 传入 prompt，不拼接命令行参数（防注入） |
| 错误信息 | 不在前端暴露 Provider 内部错误详情（如 API key 错误具体内容） |

---

## 12. 初始化策略

### 12.1 首次启动 — 默认 Provider 种子数据

```typescript
// server/api/llm/providers/index.get.ts（或专门的初始化逻辑）
// 如果 llm_providers 表为空，自动插入默认配置

const DEFAULT_PROVIDERS = [
  {
    provider: 'claude',
    name: 'Claude Haiku 4.5',
    modelName: 'haiku',
    isDefault: true,
    isEnabled: true,
    params: JSON.stringify({ temperature: 0.7, maxTokens: 2000 }),
  },
  {
    provider: 'claude',
    name: 'Claude Sonnet 4.5',
    modelName: 'sonnet',
    isDefault: false,
    isEnabled: true,
    params: JSON.stringify({ temperature: 0.7, maxTokens: 2000 }),
  },
];
```

### 12.2 数据库迁移

运行 `npx drizzle-kit generate && npx drizzle-kit migrate` 自动创建 `llm_providers` 表。

---

## 13. ADR 补充

### ADR-011: LLM Provider 接口统一为 chat

- **决策**: Provider 接口只保留 `chat(messages)` 方法，去除 `translate(word)` 方法
- **理由**: 翻译 = 特定 prompt 的聊天。保持 Provider 接口最小化，prompt 策略归调用方
- **影响**: 翻译功能由 API 路由 `/api/llm/translate` 负责构建 prompt + 解析 JSON

### ADR-012: LLM 缓存不做平台级

- **决策**: 平台不提供通用 LLM 缓存表，缓存由各工具自行管理
- **理由**: 缓存粒度、键、失效策略因工具而异，强制统一反而增加复杂度
- **影响**: vocab-tracker 在 `definitions` 表缓存，其他工具自行设计

### ADR-013: Provider 配置从前端 IndexedDB 迁移到后端 SQLite

- **决策**: llm_providers 表存储在服务端 SQLite，通过 API 管理
- **理由**:
  1. API key 不应存在前端（安全）
  2. Claude CLI 在服务端执行，provider 配置在同一层更自然
  3. 与 habits/vocab 等数据统一存储策略
- **影响**: 前端通过 `useLlm().loadProviders()` 加载，不再直接操作 IndexedDB
