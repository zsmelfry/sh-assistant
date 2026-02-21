import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smProducts } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();

  const result = await db.select()
    .from(smProducts)
    .where(eq(smProducts.isActive, true))
    .limit(1);

  return result.length > 0 ? result[0] : null;
});
