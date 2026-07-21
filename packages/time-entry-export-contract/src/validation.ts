import { TIME_ENTRY_EXPORT_MAXIMUM_RANGE_MILLISECONDS } from './constants.js';
import type {
  TimeEntryExportRequestValidation,
  ValidatedTimeEntryExportRequest,
} from './types.js';

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const canonicalMillisecondUtcPattern =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;

export function isCanonicalTimeEntryExportUuid(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidPattern.test(value);
}

export function isCanonicalMillisecondUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !canonicalMillisecondUtcPattern.test(value)) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

export function validateTimeEntryExportRequest(
  value: unknown,
): TimeEntryExportRequestValidation {
  if (!isPlainObject(value)) {
    return { status: 'invalid_request' };
  }
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 3
    || keys[0] !== 'expectedMembershipId'
    || keys[1] !== 'fromInclusive'
    || keys[2] !== 'toExclusive'
  ) {
    return { status: 'invalid_request' };
  }
  if (
    !isCanonicalTimeEntryExportUuid(value.expectedMembershipId)
    || !isCanonicalMillisecondUtcTimestamp(value.fromInclusive)
    || !isCanonicalMillisecondUtcTimestamp(value.toExclusive)
  ) {
    return { status: 'invalid_request' };
  }
  const fromEpochMilliseconds = Date.parse(value.fromInclusive);
  const toEpochMilliseconds = Date.parse(value.toExclusive);
  const rangeMilliseconds = toEpochMilliseconds - fromEpochMilliseconds;
  if (
    rangeMilliseconds <= 0
    || rangeMilliseconds > TIME_ENTRY_EXPORT_MAXIMUM_RANGE_MILLISECONDS
  ) {
    return { status: 'invalid_request' };
  }
  const request: ValidatedTimeEntryExportRequest = Object.freeze({
    expectedMembershipId: value.expectedMembershipId,
    fromInclusive: value.fromInclusive,
    toExclusive: value.toExclusive,
    fromEpochMilliseconds,
    toEpochMilliseconds,
  });
  return { status: 'valid', request };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
