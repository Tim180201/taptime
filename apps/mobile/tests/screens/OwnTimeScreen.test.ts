import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Pressable: () => null,
  ScrollView: () => null,
  StyleSheet: { create: <Value>(value: Value) => value },
  Text: () => null,
  View: () => null,
}));

const {
  formatOwnTimeTimestamp,
  ownTimeLoadStatus,
  resolveDisplayTimeZone,
} = await import('../../src/screens/OwnTimeScreen');

afterEach(() => vi.restoreAllMocks());

describe('OwnTimeScreen presentation', () => {
  it.each(['America/Los_Angeles', 'UTC', 'Not/A-Timezone', undefined])(
    'keeps Berlin and the month boundary with device timezone %s', (deviceZone) => {
      const NativeDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (locales, options) {
        return new NativeDateTimeFormat(locales, {
          ...options, timeZone: options?.timeZone ?? deviceZone,
        });
      });
      expect(resolveDisplayTimeZone()).toBe('Europe/Berlin');
      expect(formatOwnTimeTimestamp('2026-09-30T22:30:00.000Z')).toBe('01.10.26, 00:30');
      expect(formatOwnTimeTimestamp('2026-07-24T10:00:00.000Z')).toBe('24.07.26, 12:00');
  });

  it('distinguishes loaded history from complete history', () => {
    expect(ownTimeLoadStatus(20, 'v1:next')).toContain('weitere verfügbar');
    expect(ownTimeLoadStatus(27, null)).toContain('vollständig');
  });
});
