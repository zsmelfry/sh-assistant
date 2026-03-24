# LLM 集成架构

> 版本: v2.0 | 最后更新: 2026-03-24

---

## 1. 设计原则

**LLM 模块是平台级基础设施，不属于任何工具。**

- **Provider 透明**：工具层不关心底层使用哪个 LLM，只传入 prompt + messages
- **零改动接入**：新工具使用 LLM 只需 `const { chat } = useLlm()`
- **缓存自治**：平台提供通用调用，缓存策略由各工具自行管理

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                       浏览器 (Vue 3 SPA)                         │
│                                                                  │
│  各工具模块 → composables/useLlm.ts (平台级, 自动导入)            │
│       chat()  /  translate()  /  getProviders()                  │
│                          │ $fetch                                 │
├──────────────────────────┼───────────────────────────────────────┤
│                     Nitro Server                                  │
│                                                                  │
│  server/api/llm/                                                 │
│    POST /chat          ← 通用聊天                                 │
│    POST /translate     ← 词汇释义                                 │
│    GET  /providers     ← 列表                                     │
│    POST /providers     ← 添加                                     │
│    PUT  /providers/:id ← 更新                                     │
│    DELETE /providers/:id                                          │
│    POST /providers/:id/default ← 设为默认                         │
│    GET  /models        ← 自动发现可用模型                          │
│                          │                                        │
│  server/lib/llm/                                                 │
│    BaseProvider → ClaudeProvider (CLI)                            │
│                → ClaudeApiProvider (REST API)                     │
│                → GeminiProvider (REST API)                        │
│                → OllamaProvider (REST API)                        │
│    ProviderFactory (从 DB 配置创建实例)                             │
│                          │                                        │
│  llm_providers 表 (SQLite)                                       │
└──────────────────────────┼───────────────────────────────────────┘
            ┌──────────────┼──────────────┬──────────────┐
            ▼              ▼              ▼              ▼
     ┌────────────┐ ┌───────────┐ ┌────────────┐ ┌────────────┐
     │ Claude CLI │ │ Claude API│ │ Gemini API │ │ Ollama     │
     │ (本地)     │ │ (远程)    │ │ (远程免费) │ │ (本地)     │
     └────────────┘ └───────────┘ └────────────┘ └────────────┘
```

---

## 3. Provider 一览

| Provider | 类 | 接入方式 | 认证 | 特点 |
|----------|-----|---------|------|------|
| Claude CLI | `ClaudeProvider` | `child_process.spawn` 调用本地 `claude` CLI | CLI 已认证 | 无需 API key，依赖本地安装 |
| Claude API | `ClaudeApiProvider` | HTTPS REST API | API key (加密存储) | 标准 Anthropic API |
| Gemini | `GeminiProvider` | HTTPS REST API | API key (免费层可用) | 支持 gemini-2.5-flash / flash-lite |
| Ollama | `OllamaProvider` | HTTP REST API `localhost:11434` | 无 | 本地运行，支持任意模型 |

所有 Provider 继承 `BaseLlmProvider`，实现统一的 `chat(messages, options)` 接口。

---

## 4. 数据库存储

`llm_providers` 表存储 Provider 配置：

| 字段 | 说明 |
|------|------|
| provider | 类型标识: 'claude' / 'claude_api' / 'gemini' / 'ollama' |
| name | 显示名称 |
| modelName | 模型标识 |
| endpoint | API 端点 URL (Ollama/OpenAI) |
| apiKey | API 密钥 (加密存储) |
| isDefault | 是否为默认 Provider |
| isEnabled | 是否启用 |
| params | JSON 字符串 (temperature, maxTokens 等) |

---

## 5. 前端 Composable

`composables/useLlm.ts` 提供统一的 LLM 调用接口：

| 方法 | 说明 |
|------|------|
| `chat(messages, options?)` | 通用聊天 (system + user + assistant messages) |
| `translate(word, options?)` | 法语词汇释义 (内部构建翻译 prompt) |
| `providers` | 响应式 Provider 列表 |
| `defaultProvider` | 当前默认 Provider |
| `loadProviders()` | 加载 Provider 列表 |
| `addProvider()` / `deleteProvider()` / `setDefault()` | Provider 管理 |
| `discoverModels()` | 自动发现可用模型 |

---

## 6. LLM 使用场景

| 场景 | 调用方 | 说明 |
|------|--------|------|
| 文章翻译 | article-reader | SSE 流式输出 |
| 文章摘要 | article-reader | 提取核心内容 |
| 词汇释义 | vocab-tracker | 结果缓存到 definitions 表 |
| AI 教学 | skill-learning | 结构化内容 (What/How/Example/Apply/Resources)，SSE 流式 |
| 知识问答 | skill-learning | 知识点级别的 AI 对话 |
| 练习生成 | skill-learning | 生成实践练习和测验 |
| 里程碑建议 | ability-profile | AI 生成技能里程碑 |
| AI 引导 | ability-profile | 初始化时对话式引导 |
| 知识树生成 | skill-manager | AI 生成领域→主题→知识点结构 |
| 成长教练 | xiaoshuang | 跨模块智能对话 |
| AI 洞察 | dashboard | 每日个性化建议 |
| 项目聊天 | project-tracker | 项目级 AI 对话 |

---

## 7. 缓存策略

平台层不提供通用 LLM 缓存，各工具自行管理：

| 工具 | 缓存位置 | 失效策略 |
|------|----------|----------|
| vocab-tracker | `definitions` 表 (按 wordId) | 永不失效 |
| skill-learning | `smTeaching` 表 (按 pointId) | 永不失效 |
| article-reader | `articleTranslations` 表 (按 articleId + type) | 永不失效 |

---

## 8. 流式输出

文章翻译和 AI 教学使用 SSE (Server-Sent Events) 流式返回，前端实时展示生成进度。
