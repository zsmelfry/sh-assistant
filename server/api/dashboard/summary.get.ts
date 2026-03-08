import { useDB } from '~/server/database';
import { collectFullSummary } from '~/server/lib/coach/context-builder';

export default defineEventHandler(async () => {
  const db = useDB();
  return collectFullSummary(db);
});
