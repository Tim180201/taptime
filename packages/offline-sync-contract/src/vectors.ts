import type { OfflineCaptureLeaseItem } from './types.js';

export interface OfflineHmacSha256Vector {
  readonly name: string;
  readonly keyHex: string;
  readonly messageUtf8: string;
  readonly expectedHex: string;
}

export const OFFLINE_HMAC_SHA256_VECTORS: readonly OfflineHmacSha256Vector[] = Object.freeze([
  Object.freeze({
    name: 'RFC 4231 case 1',
    keyHex: '0b'.repeat(20),
    messageUtf8: 'Hi There',
    expectedHex: 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
  }),
  Object.freeze({
    name: 'RFC 4231 case 2',
    keyHex: new TextEncoder()
      .encode('Jefe')
      .reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), ''),
    messageUtf8: 'what do ya want for nothing?',
    expectedHex: '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
  }),
]);

export const OFFLINE_MANIFEST_VECTOR_ITEMS: readonly OfflineCaptureLeaseItem[] = Object.freeze([
  Object.freeze({
    itemId: '11111111-1111-4111-8111-111111111111',
    lookup: '11'.repeat(32),
    assignmentId: '22222222-2222-4222-8222-222222222222',
    nfcTagId: '33333333-3333-4333-8333-333333333333',
    targetType: 'customer' as const,
    targetId: '44444444-4444-4444-8444-444444444444',
    displayName: 'Kunde Ä',
  }),
  Object.freeze({
    itemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    lookup: 'aa'.repeat(32),
    assignmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    nfcTagId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    targetType: 'customer' as const,
    targetId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    displayName: 'Kunde B',
  }),
]);

// Computed independently with Node SHA-256 over encodeOfflineLeaseManifest(vector items).
export const OFFLINE_MANIFEST_VECTOR_SHA256 =
  'e68139eaeacc05072f6c6f7055460084bcae229f539e1abcde99d76609058834';
