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
