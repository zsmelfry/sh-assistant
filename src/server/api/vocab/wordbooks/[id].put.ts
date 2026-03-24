import { useDB } from '~/server/database';
import { eq } from 'drizzle-orm';
import { wordbooks } from '~/server/database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const id = Number(getRouterParam(event, 'id'));

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid wordbook id' });
  }

  // Validate wordbook exists
  getWordbookById(db, id);

  const body = await readBody(event);
  const { name } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw createError({ statusCode: 400, message: 'name is required' });
  }

  const updated = db.update(wordbooks)
    .set({ name: name.trim() })
    .where(eq(wordbooks.id, id))
    .returning()
    .get();

  return updated;
});
