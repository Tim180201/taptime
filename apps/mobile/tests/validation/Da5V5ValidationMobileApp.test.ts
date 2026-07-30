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
  DA5_V5_VALIDATION_CANCEL_ACTION,
  DA5_V5_VALIDATION_CONFIRM_DEVICE_ACTION,
  da5V5ValidationFontScaleText,
  da5V5ValidationProgressText,
  da5V5ValidationScanButtonText,
  da5V5ValidationStatusText,
  da5V5ValidationStatusTitle,
  da5V5ValidationTalkBackVersionText,
  da5V5ValidationTechnologyText,
} = await import('../../src/validation/Da5V5ValidationMobileApp');

describe('DA5 V5 Validation UI safety boundary', () => {
  it('uses exact visible/a11y labels and exposes no reset or retry path', async () => {
    const source = await readFile(fileURLToPath(new URL(
      '../../src/validation/Da5V5ValidationMobileApp.tsx',
      import.meta.url,
    )), 'utf8');
    expect(source).toContain("state.phase === 'capturing' ? (");
    expect(source).toContain('accessibilityLabel={scanButtonText}');
    expect(source).toContain(
      '<Text style={styles.primaryText}>{scanButtonText}</Text>',
    );
    expect(source).toContain(
      'accessibilityLabel={DA5_V5_VALIDATION_CONFIRM_DEVICE_ACTION}',
    );
    expect(source).toContain(
      '{DA5_V5_VALIDATION_CONFIRM_DEVICE_ACTION}',
    );
    expect(source).toContain(
      'accessibilityLabel={DA5_V5_VALIDATION_CANCEL_ACTION}',
    );
    expect(source).toContain('{DA5_V5_VALIDATION_CANCEL_ACTION}');
    expect(DA5_V5_VALIDATION_CONFIRM_DEVICE_ACTION).toBe(
      'Gerätebindung exakt bestätigen',
    );
    expect(DA5_V5_VALIDATION_CANCEL_ACTION).toBe('Scan abbrechen');
    expect(da5V5ValidationScanButtonText('ready', 'A')).toBe(
      'Tag A scannen',
    );
    expect(da5V5ValidationScanButtonText('capturing', 'X')).toBe(
      'Tag X an das Gerät halten …',
    );
    expect(da5V5ValidationFontScaleText(2)).toBe('200 %');
    expect(da5V5ValidationTalkBackVersionText('15.1.0')).toBe('15.1.0');
    expect(source).not.toContain('· aktiviert');
    expect(source).toContain(
      'DA5_V5_VALIDATION_FAILURE_MESSAGES[failureReason]',
    );
    expect(source).toContain('Operator-Cleanup ausführen');
    expect(da5V5ValidationStatusText(
      'failed',
      'A',
      'capture_timed_out',
    )).toBe(
      'Die laufende NFC-Erfassung wurde wegen Zeitüberschreitung gestoppt. '
      + 'Prüfung beenden und den Operator-Cleanup ausführen. '
      + 'Keine weitere Erfassung starten.',
    );
    expect(source).not.toMatch(/reset|zurücksetzen|neu beginnen/iu);
    expect(source).not.toMatch(
      /canonicalPayload|tag\.id|techTypes|nfc:uid|console\.|logger/u,
    );
  });

  it('renders the exact checkpoint, final and slot evidence contract', () => {
    expect(da5V5ValidationStatusTitle('device_checkpoint')).toBe(
      'Geräte- und Bedienungshilfen-Bindung prüfen',
    );
    expect(da5V5ValidationStatusText(
      'device_checkpoint',
      'A',
      null,
    )).toBe(
      'Alle angezeigten Werte exakt mit dem Hardware-Runbook abgleichen.',
    );
    expect(da5V5ValidationStatusTitle('complete')).toBe(
      'Alle drei Rollen stabil gebunden',
    );
    expect(da5V5ValidationStatusText('complete', 'X', null)).toBe(
      'A, B und X sind stabil, eindeutig und voneinander verschieden.',
    );
    expect(da5V5ValidationProgressText(10)).toBe('10 / 10');
    expect(da5V5ValidationTechnologyText('NfcA')).toBe('NfcA');
  });
});
