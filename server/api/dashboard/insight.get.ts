import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { coachDailyInsights } from '~/server/database/schema';
import { collectFullSummary, formatContextForPrompt } from '~/server/lib/coach/context-builder';
import { resolveProvider } from '~/server/utils/llm-provider';

export default defineEventHandler(async () => {
  const db = useDB();
  const today = new Date().toISOString().slice(0, 10);

  // Check cache
  const [cached] = await db.select().from(coachDailyInsights).where(eq(coachDailyInsights.date, today));
  if (cached) {
    return { content: cached.content, date: today };
  }

  // Generate insight from LLM
  try {
    const summary = await collectFullSummary(db);
    const dataContext = formatContextForPrompt(summary);

    const { provider } = await resolveProvider(db);

    const prompt = `你是小爽助手。根据以下用户数据，生成一句简短的每日洞察或鼓励（30-60字）。
要求：
- 基于具体数据，不说空话
- 如果有进展就认可，如果有风险就提醒，如果有里程碑临近就鼓励冲刺
- 语气自然亲切，像朋友一样
- 只输出这一句话，不要其他内容

${dataContext || '（暂无数据）'}`;

    const content = await provider.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, maxTokens: 200, timeout: 30000 },
    );

    // Cache
    await db.insert(coachDailyInsights).values({
      date: today,
      content: content.trim(),
      createdAt: Date.now(),
    });

    return { content: content.trim(), date: today };
  } catch {
    return { content: '', date: today };
  }
});
