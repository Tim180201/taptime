import { describe, expect, it } from 'vitest';
import {
  formatExactZonedDateTime,
  formatZonedDateTime,
  parseZonedLocalTimestamp,
  toZonedLocalInput,
} from '../src/timeZone';

describe('Admin Web zoned timestamp boundary', () => {
  it('round-trips one unambiguous Europe/Berlin local timestamp without normalization drift', () => {
    const canonical = parseZonedLocalTimestamp(
      '2026-07-20T10:15:30.123',
    );
    expect(canonical).toBe('2026-07-20T08:15:30.123Z');
    expect(toZonedLocalInput(canonical!)).toBe('2026-07-20T10:15:30.123');
  });

  it('fails closed for invalid and spring-forward non-existent local timestamps', () => {
    expect(parseZonedLocalTimestamp('2026-02-30T10:00')).toBeNull();
    expect(parseZonedLocalTimestamp('2026-03-29T02:30')).toBeNull();
    expect(parseZonedLocalTimestamp('not-a-time')).toBeNull();
  });

  it('fails closed for an autumn daylight-saving timestamp with two valid offsets', () => {
    expect(parseZonedLocalTimestamp('2026-10-25T02:30')).toBeNull();
  });

  it('always displays Berlin wall time and preserves exact correction timestamps', () => {
    expect(formatZonedDateTime('2026-07-20T08:15:30.123Z'))
      .toMatch(/10:15:30.*GMT\+2.*\[Europe\/Berlin\]/);
    expect(formatExactZonedDateTime('2026-07-20T08:15:30.123Z'))
      .toBe('2026-07-20 10:15:30.123 GMT+2 [Europe/Berlin]');
    expect(formatExactZonedDateTime('2026-01-20T08:15:30.123Z'))
      .toBe('2026-01-20 09:15:30.123 GMT+1 [Europe/Berlin]');
    expect(formatZonedDateTime('not-a-time')).toBe('Ungültiger Zeitpunkt');
    expect(toZonedLocalInput('not-a-time')).toBe('');
  });
});
