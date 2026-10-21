import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Meta signs every webhook delivery: `X-Hub-Signature-256: sha256=<hex HMAC-SHA256 of the
 * RAW request body under the App Secret>` (FEAT-027, ADR-0038). Checked on the bytes as
 * received — a re-serialised JSON body would differ in whitespace and key order — which is
 * why the app is created with `rawBody: true`. Constant-time compare; a missing or
 * malformed header is simply false.
 */
export function verifyMetaSignature(rawBody: Buffer | undefined, header: string | undefined, appSecret: string): boolean {
  if (!rawBody || !header || !header.startsWith('sha256=')) return false;
  const presented = header.slice('sha256='.length).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(presented)) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(presented, 'hex'));
}

/** The header value for a body — what a test (or Meta) sends. */
export function signMetaBody(rawBody: Buffer | string, appSecret: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
}
