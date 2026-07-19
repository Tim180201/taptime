import { createHmac } from 'node:crypto';

export function offlineLookupHmac(
  lookupKey: Uint8Array,
  canonicalPayload: string,
): string {
  if (lookupKey.byteLength !== 32) {
    throw new TypeError('Offline lookup key must contain exactly 32 bytes');
  }
  return hmacSha256Hex(lookupKey, canonicalPayload);
}

export function hmacSha256Hex(
  key: Uint8Array,
  messageUtf8: string,
): string {
  return createHmac('sha256', key).update(messageUtf8, 'utf8').digest('hex');
}
