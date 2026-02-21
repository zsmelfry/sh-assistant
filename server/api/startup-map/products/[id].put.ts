import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smProducts } from '~/server/database/schema';

const VALID_STAGES = ['ideation', 'researching', 'preparing', 'launched'] as const;

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的产品 ID' });
  }

  const body = await readBody(event);

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '产品名称不能为空' });
  }

  if (body.currentStage && !VALID_STAGES.includes(body.currentStage)) {
    throw createError({
      statusCode: 400,
      message: `currentStage 必须是 ${VALID_STAGES.join(', ')} 之一`,
    });
  }

  const db = useDB();

  const existing = await db.select().from(smProducts).where(eq(smProducts.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '产品不存在' });
  }

  await db.update(smProducts).set({
    name: body.name.trim(),
    description: body.description ?? existing[0].description,
    targetMarket: body.targetMarket ?? existing[0].targetMarket,
    targetCustomer: body.targetCustomer ?? existing[0].targetCustomer,
    productionSource: body.productionSource ?? existing[0].productionSource,
    currentStage: body.currentStage ?? existing[0].currentStage,
    notes: body.notes ?? existing[0].notes,
    updatedAt: Date.now(),
  }).where(eq(smProducts.id, id));

  const [updated] = await db.select().from(smProducts).where(eq(smProducts.id, id)).limit(1);
  return updated;
});
