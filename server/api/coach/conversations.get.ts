import { desc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { coachConversations } from '~/server/database/schema';
import { parsePagination } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const db = useDB();
  const { limit, offset } = parsePagination(query, { defaultLimit: 20 });

  const rows = await db.select({
    id: coachConversations.id,
    context: coachConversations.context,
    skillId: coachConversations.skillId,
    createdAt: coachConversations.createdAt,
  })
    .from(coachConversations)
    .orderBy(desc(coachConversations.createdAt))
    .limit(limit)
    .offset(offset);

  // Parse first message as preview
  return rows.map((r) => ({
    ...r,
    preview: getPreview(r),
  }));
});

function getPreview(row: { id: number; context: string }) {
  return row.context;
}
