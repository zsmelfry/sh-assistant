import { asc, eq, type SQL } from 'drizzle-orm';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { resolveProvider } from '~/server/utils/llm-provider';
import { LlmError } from '~/server/lib/llm';
import type { ChatMessage } from '~/server/lib/llm';

interface ChatHandlerOptions {
  db: BetterSQLite3Database<any>;
  message: string;
  providerId?: number;
  systemMessage: ChatMessage;
  /** Chat history table */
  chatTable: SQLiteTableWithColumns<any>;
  /** WHERE clause to filter history and insert new rows, e.g. eq(table.articleId, id) */
  historyWhere: SQL;
  /** Extra fields to insert on each chat row, e.g. { articleId: 123 } or { pointId: 456 } */
  insertFields: Record<string, unknown>;
}

/**
 * Shared chat handler: loads history, calls LLM, saves messages, returns result.
 * Handles LlmError wrapping consistently.
 */
export async function handleChatRequest(opts: ChatHandlerOptions) {
  const { db, message, providerId, systemMessage, chatTable, historyWhere, insertFields } = opts;

  // Load chat history
  const history = await db.select()
    .from(chatTable)
    .where(historyWhere)
    .orderBy(asc(chatTable.createdAt));

  // Build messages array: system + history + new user message
  const messages: ChatMessage[] = [
    systemMessage,
    ...history.map((h: any) => ({ role: h.role as ChatMessage['role'], content: h.content })),
    { role: 'user' as const, content: message.trim() },
  ];

  // Resolve LLM provider
  const { provider, config: providerConfig } = await resolveProvider(db, providerId);

  try {
    const responseContent = await provider.chat(messages, {
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 60000,
    });

    // Save user message and assistant response
    const now = Date.now();
    const [userMsg] = await db.insert(chatTable).values({
      ...insertFields,
      role: 'user',
      content: message.trim(),
      createdAt: now,
    }).returning();

    const [assistantMsg] = await db.insert(chatTable).values({
      ...insertFields,
      role: 'assistant',
      content: responseContent,
      createdAt: now + 1, // +1ms to ensure ordering
    }).returning();

    return {
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      meta: {
        provider: providerConfig.provider,
        modelName: providerConfig.modelName,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof LlmError) {
      throw createError({
        statusCode: 502,
        message: error.message,
        data: { type: error.type },
      });
    }
    if ((error as any)?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'AI 聊天失败',
    });
  }
}
