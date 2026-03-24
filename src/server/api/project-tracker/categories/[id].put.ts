import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptCategories } from '~/server/database/schema';
import { requireNumericParam, requireNonEmpty, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '分类');
  const body = await readBody(event);
  const name = requireNonEmpty(body.name, '分类名称');
  const db = useDB(event);

  await requireEntity(db, ptCategories, id, '分类');
  await db.update(ptCategories).set({ name }).where(eq(ptCategories.id, id));

  const [updated] = await db.select().from(ptCategories).where(eq(ptCategories.id, id)).limit(1);
  return updated;
});
