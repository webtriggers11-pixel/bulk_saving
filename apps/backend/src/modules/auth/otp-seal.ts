import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

/**
 * Seal an OTP for its trip through the send queue (CHORE-017, ADR-0027).
 *
 * A queued code sits in Redis — and in BullMQ's job record — until the worker sends it.
 * Sealed with AES-256-GCM under a key derived from OTP_HASH_SECRET (never the secret
 * itself, which also keys the stored code's HMAC), so a Redis dump, a MONITOR session or
 * a queue dashboard shows nothing usable. GCM authenticates too: a tampered or
 * foreign-keyed payload fails loudly instead of sending a wrong code.
 *
 * Format: base64(iv[12] ‖ tag[16] ‖ ciphertext).
 */
function key(): Buffer {
  const secret = process.env.OTP_HASH_SECRET;
  if (!secret) {
    throw new Error('OTP_HASH_SECRET is not configured.');
  }
  return createHmac('sha256', secret).update('otp-send-queue/v1').digest();
}

export function sealOtp(code: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function unsealOtp(sealed: string): string {
  const raw = Buffer.from(sealed, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}
