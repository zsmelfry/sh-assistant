import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { coachProfile } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const db = useDB();

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.content !== undefined) updates.content = body.content;
  if (body.currentFocus !== undefined) updates.currentFocus = body.currentFocus;

  // Increment version
  const [current] = await db.select().from(coachProfile);
  if (!current) {
    throw createError({ statusCode: 404, message: '画像不存在，请先访问 GET /api/coach/profile' });
  }
  updates.version = current.version + 1;

  const [updated] = await db.update(coachProfile).set(updates)
    .where(eq(coachProfile.id, 1)).returning();
  return updated;
});
