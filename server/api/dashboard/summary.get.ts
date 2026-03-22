import { useDB } from '~/server/database';
import { collectFullSummary } from '~/server/lib/coach/context-builder';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  return collectFullSummary(db);
});
