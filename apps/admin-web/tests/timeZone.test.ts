import { describe, expect, it } from 'vitest';
import {
  formatZonedDateTime,
  parseZonedLocalTimestamp,
  toZonedLocalInput,
} from '../src/timeZone';

describe('Admin Web zoned timestamp boundary', () => {
  it('round-trips one unambiguous Europe/Berlin local timestamp without normalization drift', () => {
    const canonical = parseZonedLocalTimestamp(
      '2026-07-20T10:15:30.123',
      'Europe/Berlin',
    );
    expect(canonical).toBe('2026-07-20T08:15:30.123Z');
    expect(toZonedLocalInput(canonical!, 'Europe/Berlin')).toBe('2026-07-20T10:15:30.123');
  });

  it('fails closed for invalid and spring-forward non-existent local timestamps', () => {
    expect(parseZonedLocalTimestamp('2026-02-30T10:00', 'Europe/Berlin')).toBeNull();
    expect(parseZonedLocalTimestamp('2026-03-29T02:30', 'Europe/Berlin')).toBeNull();
    expect(parseZonedLocalTimestamp('not-a-time', 'Europe/Berlin')).toBeNull();
  });

  it('fails closed for an autumn daylight-saving timestamp with two valid offsets', () => {
    expect(parseZonedLocalTimestamp('2026-10-25T02:30', 'Europe/Berlin')).toBeNull();
  });

  it('accepts UTC as an unambiguous safe fallback and declares the zone in display text', () => {
    expect(parseZonedLocalTimestamp('2026-10-25T02:30', 'UTC'))
      .toBe('2026-10-25T02:30:00.000Z');
    expect(formatZonedDateTime('2026-07-20T08:15:30.123Z', {
      timeZone: 'UTC',
      usedUtcFallback: true,
    })).toContain('[UTC]');
    expect(formatZonedDateTime('2026-07-20T08:15:30.123Z', {
      timeZone: 'Europe/Berlin',
      usedUtcFallback: false,
    })).toMatch(/10:15:30.*GMT\+2.*\[Europe\/Berlin\]/);
  });

  it('rejects an unknown time zone instead of guessing', () => {
    expect(parseZonedLocalTimestamp('2026-07-20T10:15', 'Not/A_Zone')).toBeNull();
  });
});
