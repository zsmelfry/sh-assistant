import { lt } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { verificationTokens } from '~/server/database/admin-schema';

/**
 * Nitro plugin: clean up expired verification tokens on server startup.
 * Deletes tokens that expired more than 7 days ago.
 */
export default defineNitroPlugin(() => {
  try {
    const db = useAdminDB();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const result = db.delete(verificationTokens)
      .where(lt(verificationTokens.expiresAt, sevenDaysAgo))
      .run();

    if (result.changes > 0) {
      console.log(`[token-cleanup] Deleted ${result.changes} expired verification token(s)`);
    }
  } catch (err) {
    console.error('[token-cleanup] Failed to clean up expired tokens:', err);
  }
});
