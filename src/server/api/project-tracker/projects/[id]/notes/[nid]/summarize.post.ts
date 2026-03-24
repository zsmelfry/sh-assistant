import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptNotes, ptAttachments } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';
import { resolveProvider } from '~/server/utils/llm-provider';
import { throwLlmError } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const nid = requireNumericParam(event, 'nid', '笔记');
  const db = useDB(event);

  const note = await requireEntity<any>(db, ptNotes, nid, '笔记');

  if (!note.content && !note.content?.trim()) {
    throw createError({ statusCode: 400, message: '笔记内容为空，无法生成摘要' });
  }

  // Gather attachments for context
  const attachments = await db.select().from(ptAttachments)
    .where(eq(ptAttachments.noteId, nid));

  const attachmentInfo = attachments
    .filter(a => a.type === 'url' && a.url)
    .map(a => `- ${a.caption || a.url}: ${a.url}`)
    .join('\n');

  const prompt = `请为以下笔记生成一个简洁的结构化摘要（100-200字），包含要点和关键信息：

标题：${note.title}

内容：
${note.content}
${attachmentInfo ? `\n参考链接：\n${attachmentInfo}` : ''}

请直接输出摘要，不要加任何前缀或说明。`;

  const { provider } = await resolveProvider(db);

  try {
    const summary = await provider.chat([{ role: 'user', content: prompt }], {
      maxTokens: 500,
      temperature: 0.3,
    });

    // Save summary
    await db.update(ptNotes).set({
      aiSummary: summary,
      updatedAt: Date.now(),
    }).where(eq(ptNotes.id, nid));

    return { summary };
  } catch (error) {
    throwLlmError(error, 'AI 摘要生成失败');
  }
});
