import { useDB } from '~/server/database';
import { vocabSettings } from '../../database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const db = useDB(event);

  const rows = await db.select().from(vocabSettings);

  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value ?? '';
  }

  return result;
});
