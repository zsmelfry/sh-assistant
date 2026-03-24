import { useDB } from '~/server/database';
import { desc } from 'drizzle-orm';
import { wordbooks } from '~/server/database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const db = useDB(event);

  const allWordbooks = db.select()
    .from(wordbooks)
    .orderBy(desc(wordbooks.createdAt))
    .all();

  const active = allWordbooks.find(wb => wb.isActive);
  const multiWordbookEnabled = isMultiWordbookEnabled(db);

  return {
    wordbooks: allWordbooks,
    activeWordbookId: active?.id ?? null,
    multiWordbookEnabled,
  };
});
