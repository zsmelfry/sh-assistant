import bcrypt from 'bcryptjs';
import { useDB } from '~/server/database';
import { users } from '~/server/database/schema';
import { validateUsername } from '~/server/utils/username-validation';

/**
 * Test-only endpoint: create a user for E2E tests.
 * Protected by test-guard middleware (blocked in production).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.username || !body.password) {
    throw createError({ statusCode: 400, message: 'username and password required' });
  }

  validateUsername(body.username);

  const db = useDB();
  const passwordHash = await bcrypt.hash(body.password, 10);

  await db.insert(users).values({
    username: body.username,
    passwordHash,
    createdAt: Date.now(),
  });

  return { success: true };
});
