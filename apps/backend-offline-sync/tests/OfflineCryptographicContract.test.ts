import { createHash } from 'node:crypto';
import {
  OFFLINE_HMAC_SHA256_VECTORS,
  OFFLINE_MANIFEST_VECTOR_ITEMS,
  OFFLINE_MANIFEST_VECTOR_SHA256,
} from '@taptime/offline-sync-contract';
import { describe, expect, it } from 'vitest';
import { hmacSha256Hex, offlineLookupHmac, offlineManifestDigest } from '../src/index.js';

describe('backend offline cryptographic contract', () => {
  it.each(OFFLINE_HMAC_SHA256_VECTORS)('matches $name with Node createHmac', (vector) => {
    expect(hmacSha256Hex(Buffer.from(vector.keyHex, 'hex'), vector.messageUtf8))
      .toBe(vector.expectedHex);
  });

  it('matches the shared ordered manifest digest', () => {
    expect(offlineManifestDigest(OFFLINE_MANIFEST_VECTOR_ITEMS))
      .toBe(OFFLINE_MANIFEST_VECTOR_SHA256);
  });

  it('does not accept a non-32-byte lookup key', () => {
    expect(() => offlineLookupHmac(createHash('sha256').update('x').digest().subarray(0, 31), 'x'))
      .toThrow(/32 bytes/);
  });
});
