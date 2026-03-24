import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** Derive a 32-byte encryption key from JWT_SECRET */
function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return createHash('sha256').update(secret).digest();
}

/** Encrypt a plaintext string. Returns "iv:ciphertext:tag" in hex */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/** Decrypt an "iv:ciphertext:tag" string back to plaintext */
export function decryptApiKey(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    // Likely a legacy plaintext key — return as-is
    return encrypted;
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], 'hex');
  const ciphertext = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Check if a value looks like an encrypted key (iv:ciphertext:tag format) */
export function isEncryptedKey(value: string): boolean {
  return /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(value);
}
