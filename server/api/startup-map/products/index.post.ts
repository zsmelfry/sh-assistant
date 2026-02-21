import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smProducts } from '~/server/database/schema';

const VALID_STAGES = ['ideation', 'researching', 'preparing', 'launched'] as const;

export default defineEventHandler(async (event) => {
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

  // If first product, auto-set as active; otherwise inactive
  const existing = await db.select().from(smProducts).limit(1);
  const isFirst = existing.length === 0;

  const now = Date.now();
  const [inserted] = await db.insert(smProducts).values({
    name: body.name.trim(),
    description: body.description || null,
    targetMarket: body.targetMarket || null,
    targetCustomer: body.targetCustomer || null,
    productionSource: body.productionSource || null,
    currentStage: body.currentStage || 'ideation',
    notes: body.notes || null,
    isActive: isFirst,
    createdAt: now,
    updatedAt: now,
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
