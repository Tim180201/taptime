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
  encodeOfflineLeaseManifestV2,
  isCanonicalOfflineUuid,
  isLowercaseSha256Hex,
  isOfflineAsciiCursor,
  isOfflineBase64Url32Bytes,
  isOfflineIsoTimestamp,
  isValidRetryAfterSeconds,
  isOfflineLifecycleEventCommandV2,
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

  it('frames the v2 discriminated manifest without fake NFC fields', () => {
    const encoded = encodeOfflineLeaseManifestV2([
      {
        itemType: 'nfc_assignment',
        itemId: '11111111-1111-4111-8111-111111111111',
        lookup: 'ab'.repeat(32),
        assignmentId: '22222222-2222-4222-8222-222222222222',
        nfcTagId: '33333333-3333-4333-8333-333333333333',
        targetType: 'customer',
        targetId: '44444444-4444-4444-8444-444444444444',
        displayName: 'Kunde Nord',
        assignmentRowVersion: 1,
        targetRowVersion: 2,
      },
      {
        itemType: 'manual_target',
        itemId: '55555555-5555-4555-8555-555555555555',
        targetType: 'general_work',
        targetId: '66666666-6666-4666-8666-666666666666',
        displayName: 'Allgemeine Arbeitszeit',
        targetRowVersion: 1,
      },
    ]);
    expect(encoded.byteLength).toBeGreaterThan(0);
    expect(Buffer.from(encoded).includes(Buffer.from('manual_target'))).toBe(true);
  });

  it('accepts exact manual v2 evidence and rejects caller-selected lifecycle', () => {
    const command = {
      organizationId: '11111111-1111-4111-8111-111111111111',
      expectedMembershipId: '22222222-2222-4222-8222-222222222222',
      leaseId: '33333333-3333-4333-8333-333333333333',
      leaseItemId: '44444444-4444-4444-8444-444444444444',
      installationBinding: 'A'.repeat(43),
      deviceSequence: 1,
      provenanceVersion: 2,
      clock: {
        bootMarker: 'boot',
        monotonicAnchorMilliseconds: 1,
        monotonicDeltaMilliseconds: 2,
        wallClockAnchor: '2026-07-24T12:00:00.000Z',
        clockProofStatus: 'verified_same_boot',
        clockProofVersion: 1,
      },
      workEvent: {
        id: '55555555-5555-4555-8555-555555555555',
        target: {
          targetType: 'project',
          targetId: '66666666-6666-4666-8666-666666666666',
        },
        occurredAt: '2026-07-24T12:01:00.000Z',
        trigger: { type: 'manual' },
      },
      receipt: {
        id: '77777777-7777-4777-8777-777777777777',
        attemptNumber: 1,
      },
    };
    expect(isOfflineLifecycleEventCommandV2(command)).toBe(true);
    expect(isOfflineLifecycleEventCommandV2({
      ...command,
      workEvent: { ...command.workEvent, lifecycle: 'start' },
    })).toBe(false);
  });
});
