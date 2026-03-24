import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const llmProviders = sqliteTable('llm_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull(),          // 'claude' | 'ollama' | 'openai'
  name: text('name').notNull(),                  // 显示名称: 'Claude Haiku 4.5'
  modelName: text('model_name').notNull(),       // 模型标识: 'haiku', 'qwen3:30b'
  endpoint: text('endpoint'),                    // Ollama/OpenAI 端点 URL
  apiKey: text('api_key'),                       // OpenAI API key
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
