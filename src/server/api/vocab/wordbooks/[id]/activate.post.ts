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

  // Set as active (deactivates all others)
  setActiveWordbook(db, id);

  // Return the activated wordbook
  const activated = db.select()
    .from(wordbooks)
    .where(eq(wordbooks.id, id))
    .get();

  return activated;
});
