import {
  TIME_REVIEW_MAXIMUM_ADJUDICATION_ITEMS,
  TIME_REVIEW_MAXIMUM_CURSOR_CHARACTERS,
  TIME_REVIEW_MAXIMUM_QUERY_ROWS,
  TIME_REVIEW_MAXIMUM_RANGE_MILLISECONDS,
  TIME_REVIEW_MAXIMUM_REASON_CHARACTERS,
} from './constants.js';
import type {
  MobileReviewStateRequest,
  ReviewAdjudicationRequest,
  ReviewAdjudicationResolution,
  ReviewItemQueryRequest,
  TimeRecordCorrectionRequest,
  TimeRecordQueryRequest,
  ValidationResult,
} from './types.js';

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const canonicalMillisecondUtcPattern =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;

export function isCanonicalTimeReviewUuid(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidPattern.test(value);
}

export function isCanonicalTimeReviewTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !canonicalMillisecondUtcPattern.test(value)) return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

export function isValidTimeReviewReason(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // PostgreSQL btrim(text) removes U+0020 spaces by default, and char_length
  // counts Unicode code points rather than UTF-16 code units.
  const postgresTrimmed = value.replace(/^ +/, '').replace(/ +$/, '');
  const characterCount = Array.from(postgresTrimmed).length;
  return characterCount >= 1 && characterCount <= TIME_REVIEW_MAXIMUM_REASON_CHARACTERS;
}

export function validateTimeRecordQueryRequest(
  value: unknown,
): ValidationResult<TimeRecordQueryRequest> {
  if (!hasExactKeys(value, ['cursor', 'expectedMembershipId', 'fromInclusive', 'limit', 'toExclusive'])) {
    return invalid();
  }
  if (
    !isCanonicalTimeReviewUuid(value.expectedMembershipId)
    || !isCanonicalTimeReviewTimestamp(value.fromInclusive)
    || !isCanonicalTimeReviewTimestamp(value.toExclusive)
    || !isBoundedLimit(value.limit)
    || !isCursor(value.cursor)
  ) return invalid();
  const range = Date.parse(value.toExclusive) - Date.parse(value.fromInclusive);
  if (range <= 0 || range > TIME_REVIEW_MAXIMUM_RANGE_MILLISECONDS) return invalid();
  return valid(Object.freeze({
    expectedMembershipId: value.expectedMembershipId,
    fromInclusive: value.fromInclusive,
    toExclusive: value.toExclusive,
    limit: value.limit,
    cursor: value.cursor,
  }));
}

export function validateTimeRecordCorrectionRequest(
  value: unknown,
): ValidationResult<TimeRecordCorrectionRequest> {
  if (!hasExactKeys(value, [
    'commandId', 'expectedBaseRowVersion', 'expectedMembershipId', 'expectedRevisionNumber',
    'reason', 'startedAt', 'stoppedAt', 'timeRecordId',
  ])) return invalid();
  if (
    !isCanonicalTimeReviewUuid(value.expectedMembershipId)
    || !isCanonicalTimeReviewUuid(value.commandId)
    || !isCanonicalTimeReviewUuid(value.timeRecordId)
    || !isNonNegativeInteger(value.expectedBaseRowVersion)
    || !isNonNegativeInteger(value.expectedRevisionNumber)
    || !isClosedInterval(value.startedAt, value.stoppedAt)
    || !isValidTimeReviewReason(value.reason)
  ) return invalid();
  return valid(Object.freeze({
    expectedMembershipId: value.expectedMembershipId,
    commandId: value.commandId,
    timeRecordId: value.timeRecordId,
    expectedBaseRowVersion: value.expectedBaseRowVersion,
    expectedRevisionNumber: value.expectedRevisionNumber,
    startedAt: value.startedAt,
    stoppedAt: value.stoppedAt as string,
    reason: value.reason,
  }));
}

export function validateReviewItemQueryRequest(
  value: unknown,
): ValidationResult<ReviewItemQueryRequest> {
  if (!hasExactKeys(value, ['cursor', 'expectedMembershipId', 'limit'])) return invalid();
  if (
    !isCanonicalTimeReviewUuid(value.expectedMembershipId)
    || !isBoundedLimit(value.limit)
    || !isCursor(value.cursor)
  ) return invalid();
  return valid(Object.freeze({
    expectedMembershipId: value.expectedMembershipId,
    limit: value.limit,
    cursor: value.cursor,
  }));
}

export function validateReviewAdjudicationRequest(
  value: unknown,
): ValidationResult<ReviewAdjudicationRequest> {
  if (!hasExactKeys(value, [
    'commandId', 'expectedMembershipId', 'reason', 'resolution', 'reviewItemIds',
  ])) return invalid();
  if (
    !isCanonicalTimeReviewUuid(value.expectedMembershipId)
    || !isCanonicalTimeReviewUuid(value.commandId)
    || !isValidTimeReviewReason(value.reason)
    || !Array.isArray(value.reviewItemIds)
    || value.reviewItemIds.length < 1
    || value.reviewItemIds.length > TIME_REVIEW_MAXIMUM_ADJUDICATION_ITEMS
    || value.reviewItemIds.some((item) => !isCanonicalTimeReviewUuid(item))
    || new Set(value.reviewItemIds).size !== value.reviewItemIds.length
  ) return invalid();
  const resolution = validateResolution(value.resolution);
  if (resolution === null) return invalid();
  return valid(Object.freeze({
    expectedMembershipId: value.expectedMembershipId,
    commandId: value.commandId,
    reviewItemIds: Object.freeze([...value.reviewItemIds]) as readonly string[],
    resolution,
    reason: value.reason,
  }));
}

export function validateMobileReviewStateRequest(
  value: unknown,
): ValidationResult<MobileReviewStateRequest> {
  if (!hasExactKeys(value, ['expectedMembershipId', 'installationId'])) return invalid();
  if (
    !isCanonicalTimeReviewUuid(value.expectedMembershipId)
    || !isCanonicalTimeReviewUuid(value.installationId)
  ) return invalid();
  return valid(Object.freeze({
    expectedMembershipId: value.expectedMembershipId,
    installationId: value.installationId,
  }));
}

export function canonicalTimeReviewCommandPayload(
  request: TimeRecordCorrectionRequest | ReviewAdjudicationRequest,
): string {
  if ('timeRecordId' in request) {
    return JSON.stringify([
      'time_record_correction_v1', request.expectedMembershipId, request.commandId,
      request.timeRecordId, request.expectedBaseRowVersion, request.expectedRevisionNumber,
      request.startedAt, request.stoppedAt, request.reason,
    ]);
  }
  const resolution = request.resolution.type === 'no_time_record_change'
    ? [request.resolution.type]
    : request.resolution.type === 'create_recovered_time_record'
      ? [request.resolution.type, request.resolution.startedAt, request.resolution.stoppedAt]
      : [
          request.resolution.type, request.resolution.timeRecordId,
          request.resolution.expectedBaseRowVersion, request.resolution.expectedRevisionNumber,
          request.resolution.startedAt, request.resolution.stoppedAt,
        ];
  return JSON.stringify([
    'review_adjudication_v1', request.expectedMembershipId, request.commandId,
    request.reviewItemIds, resolution, request.reason,
  ]);
}

function validateResolution(value: unknown): ReviewAdjudicationResolution | null {
  if (!isPlainObject(value) || typeof value.type !== 'string') return null;
  if (value.type === 'no_time_record_change') {
    return hasExactKeys(value, ['type']) ? Object.freeze({ type: value.type }) : null;
  }
  if (value.type === 'create_recovered_time_record') {
    if (!hasExactKeys(value, ['startedAt', 'stoppedAt', 'type'])
      || !isClosedInterval(value.startedAt, value.stoppedAt)) return null;
    return Object.freeze({
      type: value.type,
      startedAt: value.startedAt,
      stoppedAt: value.stoppedAt as string,
    });
  }
  if (value.type === 'adjust_existing_time_record') {
    if (!hasExactKeys(value, [
      'expectedBaseRowVersion', 'expectedRevisionNumber', 'startedAt', 'stoppedAt',
      'timeRecordId', 'type',
    ])
      || !isCanonicalTimeReviewUuid(value.timeRecordId)
      || !isNonNegativeInteger(value.expectedBaseRowVersion)
      || !isNonNegativeInteger(value.expectedRevisionNumber)
      || !isClosedInterval(value.startedAt, value.stoppedAt)) return null;
    return Object.freeze({
      type: value.type,
      timeRecordId: value.timeRecordId,
      expectedBaseRowVersion: value.expectedBaseRowVersion,
      expectedRevisionNumber: value.expectedRevisionNumber,
      startedAt: value.startedAt,
      stoppedAt: value.stoppedAt as string,
    });
  }
  return null;
}

function isClosedInterval(startedAt: unknown, stoppedAt: unknown): startedAt is string {
  return isCanonicalTimeReviewTimestamp(startedAt)
    && isCanonicalTimeReviewTimestamp(stoppedAt)
    && Date.parse(startedAt) <= Date.parse(stoppedAt);
}

function isBoundedLimit(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= TIME_REVIEW_MAXIMUM_QUERY_ROWS;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isCursor(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length >= 1
    && value.length <= TIME_REVIEW_MAXIMUM_CURSOR_CHARACTERS);
}

function hasExactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valid<T>(request: T): ValidationResult<T> {
  return { status: 'valid', request };
}

function invalid<T>(): ValidationResult<T> {
  return { status: 'invalid_request' };
}
