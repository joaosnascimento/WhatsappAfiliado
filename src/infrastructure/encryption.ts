import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function keyFromEnv(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is required for credential encryption.');
  const hex = raw.trim();
  if (process.env.NODE_ENV === 'production' && !/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('ENCRYPTION_KEY must be exactly 64 hexadecimal characters in production.');
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptCredentials(value: Record<string, unknown>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromEnv(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ v: 1, alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: tag.toString('base64'), data: ciphertext.toString('base64') });
}

export function decryptCredentials<T extends Record<string, unknown>>(payload: string): T {
  const parsed = JSON.parse(payload) as { v: number; alg: string; iv: string; tag: string; data: string };
  if (parsed.v !== 1 || parsed.alg !== 'aes-256-gcm') throw new Error('Unsupported credential encryption format.');
  const decipher = createDecipheriv('aes-256-gcm', keyFromEnv(), Buffer.from(parsed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(parsed.data, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as T;
}
