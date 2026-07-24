import {
  OFFLINE_BASE64URL_32_BYTE_LENGTH,
  OFFLINE_LEASE_CURSOR_MAXIMUM_BYTES,
  OFFLINE_RETRY_AFTER_MAXIMUM_SECONDS,
  OFFLINE_RETRY_AFTER_MINIMUM_SECONDS,
  OFFLINE_SHA256_HEX_LENGTH,
} from './constants.js';

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const base64Url32BytePattern = /^[A-Za-z0-9_-]{43}$/;
const lowercaseSha256Pattern = /^[0-9a-f]{64}$/;
const asciiPattern = /^[\x20-\x7e]*$/;
const isoTimestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export function isCanonicalOfflineUuid(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidPattern.test(value);
}

export function isOfflineBase64Url32Bytes(value: unknown): value is string {
  return typeof value === 'string'
    && value.length === OFFLINE_BASE64URL_32_BYTE_LENGTH
    && base64Url32BytePattern.test(value);
}

export function isLowercaseSha256Hex(value: unknown): value is string {
  return typeof value === 'string'
    && value.length === OFFLINE_SHA256_HEX_LENGTH
    && lowercaseSha256Pattern.test(value);
}

export function isOfflineAsciiCursor(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= OFFLINE_LEASE_CURSOR_MAXIMUM_BYTES
    && asciiPattern.test(value);
}

export function isOfflineIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !isoTimestampPattern.test(value)) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds);
}

export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function isValidRetryAfterSeconds(value: unknown): value is number {
  return isPositiveSafeInteger(value)
    && value >= OFFLINE_RETRY_AFTER_MINIMUM_SECONDS
    && value <= OFFLINE_RETRY_AFTER_MAXIMUM_SECONDS;
}

export function isOfflineTargetTypeV2(
  value: unknown,
): value is 'customer' | 'project' | 'general_work' {
  return value === 'customer' || value === 'project' || value === 'general_work';
}

export function isOfflineLifecycleEventCommandV2(value: unknown): boolean {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      'organizationId',
      'expectedMembershipId',
      'leaseId',
      'leaseItemId',
      'installationBinding',
      'deviceSequence',
      'provenanceVersion',
      'clock',
      'workEvent',
      'receipt',
    ])
    || !isCanonicalOfflineUuid(value.organizationId)
    || !isCanonicalOfflineUuid(value.expectedMembershipId)
    || !isCanonicalOfflineUuid(value.leaseId)
    || !isCanonicalOfflineUuid(value.leaseItemId)
    || !isOfflineBase64Url32Bytes(value.installationBinding)
    || !isPositiveSafeInteger(value.deviceSequence)
    || value.provenanceVersion !== 2
    || !isClockProof(value.clock)
    || !isRecord(value.receipt)
    || !hasExactKeys(value.receipt, ['id', 'attemptNumber'])
    || !isCanonicalOfflineUuid(value.receipt.id)
    || value.receipt.attemptNumber !== 1
    || !isRecord(value.workEvent)
    || !hasExactKeys(value.workEvent, ['id', 'target', 'occurredAt', 'trigger'])
    || !isCanonicalOfflineUuid(value.workEvent.id)
    || !isOfflineIsoTimestamp(value.workEvent.occurredAt)
    || !isRecord(value.workEvent.target)
    || !hasExactKeys(value.workEvent.target, ['targetType', 'targetId'])
    || !isOfflineTargetTypeV2(value.workEvent.target.targetType)
    || !isCanonicalOfflineUuid(value.workEvent.target.targetId)
    || !isRecord(value.workEvent.trigger)
  ) {
    return false;
  }
  const trigger = value.workEvent.trigger;
  return (
    hasExactKeys(trigger, ['type'])
    && trigger.type === 'manual'
  ) || (
    hasExactKeys(trigger, ['type', 'assignmentId', 'nfcTagId'])
    && trigger.type === 'nfc'
    && isCanonicalOfflineUuid(trigger.assignmentId)
    && isCanonicalOfflineUuid(trigger.nfcTagId)
  );
}

function isClockProof(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, [
      'bootMarker',
      'monotonicAnchorMilliseconds',
      'monotonicDeltaMilliseconds',
      'wallClockAnchor',
      'clockProofStatus',
      'clockProofVersion',
    ])
    && typeof value.bootMarker === 'string'
    && value.bootMarker.length > 0
    && value.bootMarker.length <= 256
    && Number.isSafeInteger(value.monotonicAnchorMilliseconds)
    && Number(value.monotonicAnchorMilliseconds) >= 0
    && Number.isSafeInteger(value.monotonicDeltaMilliseconds)
    && Number(value.monotonicDeltaMilliseconds) >= 0
    && isOfflineIsoTimestamp(value.wallClockAnchor)
    && (value.clockProofStatus === 'verified_same_boot'
      || value.clockProofStatus === 'review_only')
    && value.clockProofVersion === 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}
