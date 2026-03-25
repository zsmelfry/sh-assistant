import bcrypt from 'bcryptjs';
import { useAdminDB } from '~/server/database';
import { users, userModules } from '~/server/database/admin-schema';
import { validateUsername } from '~/server/utils/username-validation';
import { initUserDB } from '~/server/utils/user-db-init';

const ALL_MODULE_IDS = [
  'dashboard', 'ability-profile', 'habit-tracker', 'annual-planner',
  'vocab-tracker', 'article-reader', 'project-tracker', 'skill-manager', 'xiaoshuang',
];

/**
 * Test-only endpoint: create a user for E2E tests.
 * Creates user in admin.db + initializes user DB.
 * Protected by test-guard middleware (blocked in production).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.username || !body.password) {
    throw createError({ statusCode: 400, message: 'username and password required' });
  }

  validateUsername(body.username);

  const db = useAdminDB();
  const passwordHash = await bcrypt.hash(body.password, 10);
  const now = Date.now();

  // Insert user into admin.db
  // Auto-generate email from username if not provided (needed for email-based login)
  const email = body.email || `${body.username}@test.local`;
  const [user] = await db.insert(users).values({
    username: body.username,
    passwordHash,
    role: 'admin',
    email,
    createdAt: now,
  }).returning();

  // Enable all modules for test user
  if (user) {
    await db.insert(userModules).values(
      ALL_MODULE_IDS.map((moduleId) => ({
        userId: user.id,
        moduleId,
        enabled: true,
        updatedAt: now,
      })),
    );
  }

  // Initialize user DB with schema
  initUserDB(body.username);

  return { success: true };
});
