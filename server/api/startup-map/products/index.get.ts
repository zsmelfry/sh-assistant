import { asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smProducts } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  return await db.select().from(smProducts).orderBy(asc(smProducts.createdAt));
});
