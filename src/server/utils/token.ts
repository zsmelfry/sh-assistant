import { randomBytes, createHash } from 'node:crypto';

/** How long invite tokens remain valid (hours) */
export const INVITE_EXPIRES_HOURS = 72;

/**
 * Hash a token string using SHA-256.
 * Used for storing and looking up verification tokens without storing plaintext.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure token and its hash.
 * - token: 32 random bytes encoded as base64url (43 chars, URL-safe)
 * - hash: SHA-256 hex digest of the token (stored in DB)
 */
export function generateToken(): { token: string; hash: string } {
  const buffer = randomBytes(32);
  const token = buffer.toString('base64url');
  const hash = hashToken(token);
  return { token, hash };
}
