import { useDB } from '~/server/database';
import { collectFullSummary } from '~/server/lib/coach/context-builder';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const enabledModules: string[] | undefined = event.context.auth?.enabledModules;
  return collectFullSummary(db, enabledModules);
});
