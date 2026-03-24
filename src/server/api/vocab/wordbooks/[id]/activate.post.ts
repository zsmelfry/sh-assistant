import { useDB } from '~/server/database';
import { eq } from 'drizzle-orm';
import { wordbooks } from '~/server/database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const id = Number(getRouterParam(event, 'id'));

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的词汇本ID' });
  }

  // Validate wordbook exists
  getWordbookById(db, id);

  // Set as active (deactivates all others)
  setActiveWordbook(db, id);

  // Return the activated wordbook
  const activated = db.select()
    .from(wordbooks)
    .where(eq(wordbooks.id, id))
    .get();

  return activated;
});
