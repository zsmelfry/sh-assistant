import { useDB } from '~/server/database';
import { habits, VALID_FREQUENCIES } from '~/server/database/schemas/habits';
import { requireNonEmpty } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const name = requireNonEmpty(body.name, '习惯名称');

  const frequency = body.frequency || 'daily';
  if (!VALID_FREQUENCIES.includes(frequency)) {
    throw createError({ statusCode: 400, message: '无效的频率类型' });
  }

  const now = Date.now();
  const newHabit = {
    id: crypto.randomUUID(),
    name,
    frequency: frequency as 'daily' | 'weekly' | 'monthly',
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  const db = useDB();
  await db.insert(habits).values(newHabit);

  setResponseStatus(event, 201);
  return newHabit;
});
