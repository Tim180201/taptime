import { describe, expect, it, vi } from 'vitest';

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

describe('OwnTimeScreen presentation', () => {
  it('uses the named valid device IANA timezone and falls back visibly to UTC', () => {
    expect(resolveDisplayTimeZone(() => 'Europe/Berlin')).toBe('Europe/Berlin');
    expect(resolveDisplayTimeZone(() => 'Not/A-Timezone')).toBe('UTC');
    expect(resolveDisplayTimeZone(() => undefined)).toBe('UTC');
    expect(formatOwnTimeTimestamp(
      '2026-07-24T10:00:00.000Z',
      'Europe/Berlin',
    )).not.toBe(formatOwnTimeTimestamp('2026-07-24T10:00:00.000Z', 'UTC'));
  });

  it('distinguishes loaded history from complete history', () => {
    expect(ownTimeLoadStatus(20, 'v1:next')).toContain('weitere verfügbar');
    expect(ownTimeLoadStatus(27, null)).toContain('vollständig');
  });
});
