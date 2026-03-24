import { and, gte, lte, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skillSnapshots } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const db = useDB(event);

  const from = query.from as string | undefined;
  const to = query.to as string | undefined;

  const conditions = [];
  if (from) conditions.push(gte(skillSnapshots.date, from));
  if (to) conditions.push(lte(skillSnapshots.date, to));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select().from(skillSnapshots)
    .where(where)
    .orderBy(asc(skillSnapshots.date));

  return rows.map((r) => ({
    ...r,
    radarData: JSON.parse(r.radarData),
    skillData: JSON.parse(r.skillData),
  }));
});
