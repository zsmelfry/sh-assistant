import { useDB } from '~/server/database';
import { plannerDomains } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const db = useDB(event);

  const rows = await db
    .selectDistinct({ year: plannerDomains.year })
    .from(plannerDomains)
    .orderBy(plannerDomains.year);

  return rows.map(r => r.year);
});
