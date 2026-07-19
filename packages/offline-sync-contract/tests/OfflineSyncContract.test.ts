import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  OFFLINE_BASE64URL_32_BYTE_LENGTH,
  OFFLINE_CAPTURE_LEASE_LIFETIME_MILLISECONDS,
  OFFLINE_CLOCK_TOLERANCE_MILLISECONDS,
  OFFLINE_HMAC_SHA256_VECTORS,
  OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES,
  OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS,
  OFFLINE_MANIFEST_VECTOR_ITEMS,
  OFFLINE_MANIFEST_VECTOR_SHA256,
  OFFLINE_QUEUE_MAXIMUM_EVENTS,
  OFFLINE_QUEUE_MAXIMUM_EVENT_BYTES,
  OFFLINE_QUEUE_MAXIMUM_TOTAL_BYTES,
  encodeLengthFramedUtf8,
  encodeOfflineLeaseManifest,
  isCanonicalOfflineUuid,
  isLowercaseSha256Hex,
  isOfflineAsciiCursor,
  isOfflineBase64Url32Bytes,
  isOfflineIsoTimestamp,
  isValidRetryAfterSeconds,
} from '../src/index.js';

describe('offline synchronization contract', () => {
  it('freezes the Human-accepted numeric policies', () => {
    expect(OFFLINE_CAPTURE_LEASE_LIFETIME_MILLISECONDS).toBe(43_200_000);
    expect(OFFLINE_CLOCK_TOLERANCE_MILLISECONDS).toBe(300_000);
    expect(OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS).toBe(4_096);
    expect(OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES).toBe(4_194_304);
    expect(OFFLINE_QUEUE_MAXIMUM_EVENTS).toBe(256);
    expect(OFFLINE_QUEUE_MAXIMUM_EVENT_BYTES).toBe(4_096);
    expect(OFFLINE_QUEUE_MAXIMUM_TOTAL_BYTES).toBe(1_048_576);
    expect(OFFLINE_BASE64URL_32_BYTE_LENGTH).toBe(43);
  });

  it.each(OFFLINE_HMAC_SHA256_VECTORS)('matches $name', (vector) => {
    expect(
      createHmac('sha256', Buffer.from(vector.keyHex, 'hex'))
        .update(vector.messageUtf8, 'utf8')
        .digest('hex'),
    ).toBe(vector.expectedHex);
  });

  it('matches the complete cross-runtime manifest golden vector', () => {
    const encoded = encodeOfflineLeaseManifest(OFFLINE_MANIFEST_VECTOR_ITEMS);
    expect(createHash('sha256').update(encoded).digest('hex'))
      .toBe(OFFLINE_MANIFEST_VECTOR_SHA256);
  });

  it('uses unambiguous big-endian UTF-8 length framing', () => {
    expect(Buffer.from(encodeLengthFramedUtf8(['A', 'Ä'])).toString('hex'))
      .toBe('000000014100000002c384');
  });

  it('rejects unordered and duplicate manifest inputs', () => {
    expect(() => encodeOfflineLeaseManifest([...OFFLINE_MANIFEST_VECTOR_ITEMS].reverse()))
      .toThrow(/strictly ordered/);
    expect(() => encodeOfflineLeaseManifest([
      OFFLINE_MANIFEST_VECTOR_ITEMS[0]!,
      { ...OFFLINE_MANIFEST_VECTOR_ITEMS[1]!, lookup: OFFLINE_MANIFEST_VECTOR_ITEMS[0]!.lookup },
    ])).toThrow(/duplicate/);
  });

  it('validates closed wire primitives without normalization', () => {
    expect(isCanonicalOfflineUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isCanonicalOfflineUuid('11111111-1111-4111-8111-11111111111A')).toBe(false);
    expect(isOfflineBase64Url32Bytes('A'.repeat(43))).toBe(true);
    expect(isOfflineBase64Url32Bytes('A'.repeat(42))).toBe(false);
    expect(isLowercaseSha256Hex('ab'.repeat(32))).toBe(true);
    expect(isLowercaseSha256Hex('AB'.repeat(32))).toBe(false);
    expect(isOfflineAsciiCursor('page:2')).toBe(true);
    expect(isOfflineAsciiCursor('ä')).toBe(false);
    expect(isOfflineIsoTimestamp('2026-07-18T10:00:00.000Z')).toBe(true);
    expect(isOfflineIsoTimestamp('2026-07-18')).toBe(false);
    expect(isValidRetryAfterSeconds(1)).toBe(true);
    expect(isValidRetryAfterSeconds(900)).toBe(true);
    expect(isValidRetryAfterSeconds(0)).toBe(false);
    expect(isValidRetryAfterSeconds(901)).toBe(false);
  });
});
