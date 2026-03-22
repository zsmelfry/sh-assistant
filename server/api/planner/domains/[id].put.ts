import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerDomains } from '~/server/database/schema';
import { requireNumericParam, requireNonEmpty, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '领域');
  const body = await readBody(event);
  const name = requireNonEmpty(body.name, '领域名称');

  const db = useDB(event);
  await requireEntity(db, plannerDomains, id, '领域');

  await db.update(plannerDomains)
    .set({ name, updatedAt: Date.now() })
    .where(eq(plannerDomains.id, id));

  const [updated] = await db.select().from(plannerDomains).where(eq(plannerDomains.id, id)).limit(1);
  return updated;
});
