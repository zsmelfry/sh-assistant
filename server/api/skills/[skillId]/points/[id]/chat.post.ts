import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smTeachings, smChats } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam, requireNonEmpty } from '~/server/utils/handler-helpers';
import { handleChatRequest } from '~/server/utils/chat-handler';

export default defineEventHandler(async (event) => {
  const { skillId, config } = await resolveSkill(event);
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  const { message, providerId } = body || {};
  requireNonEmpty(message, '消息内容');

  const db = useDB();
  const { point, topic, domain } = await requirePointForSkill(db, id, skillId);

  // Fetch teaching content summary
  const [teaching] = await db.select().from(smTeachings).where(eq(smTeachings.pointId, id)).limit(1);
  const teachingSummary = teaching
    ? [teaching.what, teaching.how].filter(Boolean).join('\n').slice(0, 2000)
    : '';

  return handleChatRequest({
    db,
    message,
    providerId,
    systemMessage: config.buildChatSystemMessage({
      point, topic, domain, teachingSummary,
    }),
    chatTable: smChats,
    historyWhere: eq(smChats.pointId, id),
    insertFields: { pointId: id },
  });
});
