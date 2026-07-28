import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Pressable: () => null,
  SafeAreaView: () => null,
  ScrollView: () => null,
  StyleSheet: { create: <Value>(value: Value) => value },
  Text: () => null,
  View: () => null,
}));
vi.mock(
  '../../src/validation/createDa5V5ValidationRuntime',
  () => ({ createDa5V5ValidationRuntime: vi.fn() }),
);

const {
  shouldShowDa5V5ValidationReset,
} = await import(
  '../../src/validation/Da5V5ValidationMobileApp'
);

describe('DA5 V5 Validation UI safety boundary', () => {
  it('removes Reset during capture while retaining explicit Cancel', async () => {
    expect(shouldShowDa5V5ValidationReset('capturing')).toBe(false);
    expect(shouldShowDa5V5ValidationReset('failed')).toBe(true);
    expect(shouldShowDa5V5ValidationReset('complete')).toBe(true);

    const source = await readFile(fileURLToPath(new URL(
      '../../src/validation/Da5V5ValidationMobileApp.tsx',
      import.meta.url,
    )), 'utf8');
    expect(source).toContain(
      'shouldShowDa5V5ValidationReset(state.phase)',
    );
    expect(source).toContain("state.phase === 'capturing' ? (");
    expect(source).toContain('Scan abbrechen');
    expect(source).toContain(
      'DA5_V5_VALIDATION_FAILURE_MESSAGES[failureReason]',
    );
    expect(source).not.toMatch(
      /canonicalPayload|tag\.id|techTypes|nfc:uid|console\.|logger/u,
    );
  });
});
