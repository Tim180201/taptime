import type { Brand } from './ids';

export type Timestamp = Brand<string, 'Timestamp'>;

// Explicit offsets preserve the instant across runtimes; Date.parse alone normalizes invalid days.
export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!
    && Number.isFinite(Date.parse(value));
}

export function createTimestamp(isoValue: string): Timestamp {
  if (!isIsoTimestamp(isoValue)) {
    throw new Error('Timestamp must be a valid ISO 8601 date string with an offset');
  }
  return isoValue as Timestamp;
}
