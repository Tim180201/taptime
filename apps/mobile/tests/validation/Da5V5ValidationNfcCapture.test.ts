import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeManager = vi.hoisted(() => ({
  isEnabled: vi.fn(),
  isSupported: vi.fn(),
  registerTagEvent: vi.fn(),
  setEventListener: vi.fn(),
  start: vi.fn(),
  unregisterTagEvent: vi.fn(),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('react-native-nfc-manager', () => ({
  default: nativeManager,
  NfcEvents: { DiscoverTag: 'NfcManagerDiscoverTag' },
}));

const {
  createValidationCanonicalUidPayload,
  Da5V5ValidationNfcCapture,
  DA5_V5_VALIDATION_TECHNOLOGY,
  hasAllowedTechnologyEvidence,
} = await import(
  '../../src/validation/Da5V5ValidationNfcCapture'
);

type NativeTag = {
  readonly id?: string;
  readonly techTypes?: string[];
};

function discover(tag: NativeTag): void {
  const listener = nativeManager.setEventListener.mock.calls
    .findLast(([, candidate]) => typeof candidate === 'function')?.[1];
  if (typeof listener !== 'function') {
    throw new Error('Validation discovery listener is unavailable');
  }
  listener(tag);
}

function capture() {
  return new Da5V5ValidationNfcCapture({
    manager: nativeManager,
    platform: 'android',
    digestCanonicalPayload: vi.fn(async () => 'a'.repeat(64)),
  });
}

describe('DA5 V5 validation-only NFC capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nativeManager.isEnabled.mockResolvedValue(true);
    nativeManager.isSupported.mockResolvedValue(true);
    nativeManager.registerTagEvent.mockResolvedValue(undefined);
    nativeManager.start.mockResolvedValue(undefined);
    nativeManager.unregisterTagEvent.mockResolvedValue(undefined);
  });

  it('reduces UID and exact Technology to safe evidence before returning', async () => {
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    discover({
      id: '04a1b2c3',
      techTypes: [
        'android.nfc.tech.MifareUltralight',
        'android.nfc.tech.NfcA',
      ],
    });
    await expect(result).resolves.toEqual({
      status: 'captured',
      fingerprint: 'AAAAAAAAAAAA',
      technology: DA5_V5_VALIDATION_TECHNOLOGY,
    });
    expect(JSON.stringify(await result)).not.toMatch(
      /04a1b2c3|nfc:uid|android\.nfc\.tech/u,
    );
    expect(nativeManager.setEventListener).toHaveBeenLastCalledWith(
      'NfcManagerDiscoverTag',
      null,
    );
    expect(nativeManager.unregisterTagEvent).toHaveBeenCalledTimes(1);
  });

  it('normalizes the known Ndef superset to the closed core proof', async () => {
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    discover({
      id: '04a1b2c3',
      techTypes: [
        'android.nfc.tech.Ndef',
        'android.nfc.tech.NfcA',
        'android.nfc.tech.MifareUltralight',
      ],
    });
    await expect(result).resolves.toEqual({
      status: 'captured',
      fingerprint: 'AAAAAAAAAAAA',
      technology: 'NfcA+MifareUltralight',
    });
    expect(JSON.stringify(await result)).not.toContain('Ndef');
  });

  it('matches the canonical UID v1 encoding without a Product barrel import', () => {
    expect(createValidationCanonicalUidPayload('04a1B2c3')).toBe(
      'nfc:uid:v1:04A1B2C3',
    );
    for (const invalid of ['', '0', 'xyz', 'A'.repeat(66)]) {
      expect(() => createValidationCanonicalUidPayload(invalid)).toThrow();
    }
  });

  it.each([
    undefined,
    [],
    ['android.nfc.tech.NfcA'],
    [
      'android.nfc.tech.NfcA',
      'android.nfc.tech.NfcA',
    ],
    [
      'android.nfc.tech.NfcA',
      'android.nfc.tech.IsoDep',
    ],
  ])('rejects missing, ambiguous or foreign Technology %#', (technology) => {
    expect(hasAllowedTechnologyEvidence(technology)).toBe(false);
  });

  it('accepts the required core Technology pair independent of order', () => {
    expect(hasAllowedTechnologyEvidence([
      'android.nfc.tech.NfcA',
      'android.nfc.tech.MifareUltralight',
    ])).toBe(true);
    expect(hasAllowedTechnologyEvidence([
      'android.nfc.tech.MifareUltralight',
      'android.nfc.tech.NfcA',
    ])).toBe(true);
  });

  it('accepts only the known formatted or formatable-tag supersets', () => {
    expect(hasAllowedTechnologyEvidence([
      'android.nfc.tech.Ndef',
      'android.nfc.tech.NfcA',
      'android.nfc.tech.MifareUltralight',
    ])).toBe(true);
    expect(hasAllowedTechnologyEvidence([
      'android.nfc.tech.NfcA',
      'android.nfc.tech.MifareUltralight',
      'android.nfc.tech.Ndef',
      'android.nfc.tech.NdefFormatable',
    ])).toBe(true);
    expect(hasAllowedTechnologyEvidence([
      'android.nfc.tech.NfcA',
      'android.nfc.tech.MifareUltralight',
      'android.nfc.tech.NdefFormatable',
    ])).toBe(true);
    expect(hasAllowedTechnologyEvidence([
      'android.nfc.tech.NfcA',
      'android.nfc.tech.MifareUltralight',
      'android.nfc.tech.NdefFormatable',
      'android.nfc.tech.IsoDep',
    ])).toBe(false);
  });

  it('fails before hashing when Technology provenance is rejected', async () => {
    const digest = vi.fn(async () => 'a'.repeat(64));
    const runtime = new Da5V5ValidationNfcCapture({
      manager: nativeManager,
      platform: 'android',
      digestCanonicalPayload: digest,
    });
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    discover({
      id: '04A1B2C3',
      techTypes: [
        'android.nfc.tech.NfcA',
        'android.nfc.tech.Ndef',
      ],
    });
    await expect(result).resolves.toEqual({
      status: 'technology_rejected',
    });
    expect(digest).not.toHaveBeenCalled();
  });

  it('rejects a concurrent direct capture and cleans the active listener', async () => {
    const runtime = capture();
    const first = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    await expect(runtime.capture()).resolves.toEqual({
      status: 'concurrent_rejected',
    });
    await runtime.cancelCapture();
    await expect(first).resolves.toEqual({ status: 'cancelled' });
    expect(nativeManager.unregisterTagEvent).toHaveBeenCalledTimes(1);
  });

  it('stop removes the native listener without publishing retained evidence', async () => {
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    await runtime.stop();
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    expect(nativeManager.setEventListener).toHaveBeenLastCalledWith(
      'NfcManagerDiscoverTag',
      null,
    );
  });

  it('stop waits for late registration and closes it before returning', async () => {
    let releaseRegistration!: () => void;
    nativeManager.registerTagEvent.mockImplementation(() => (
      new Promise<void>((resolve) => {
        releaseRegistration = resolve;
      })
    ));
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    const stop = runtime.stop();
    releaseRegistration();
    await expect(stop).resolves.toBeUndefined();
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    expect(nativeManager.unregisterTagEvent).toHaveBeenCalledTimes(1);
  });

  it('fails closed within a deterministic bound when registration never settles', async () => {
    let cleanupTimeout!: () => void;
    nativeManager.registerTagEvent.mockImplementation(
      () => new Promise<void>(() => undefined),
    );
    const runtime = new Da5V5ValidationNfcCapture({
      manager: nativeManager,
      platform: 'android',
      digestCanonicalPayload: vi.fn(async () => 'a'.repeat(64)),
      scheduleCleanupTimeout: (callback) => {
        cleanupTimeout = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearScheduledCleanupTimeout: vi.fn(),
    });
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    const stop = runtime.stop();
    cleanupTimeout();
    await expect(stop).rejects.toThrow(/cleanup failed closed/u);
    await expect(result).resolves.toEqual({ status: 'unavailable' });
    await expect(runtime.capture()).resolves.toEqual({
      status: 'concurrent_rejected',
    });
  });

  it('reports failed-closed cleanup when native unregister rejects', async () => {
    nativeManager.unregisterTagEvent.mockRejectedValue(
      new Error('synthetic unregister failure'),
    );
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    discover({
      id: '04a1b2c3',
      techTypes: [
        'android.nfc.tech.NfcA',
        'android.nfc.tech.MifareUltralight',
      ],
    });
    await expect(result).resolves.toEqual({ status: 'unavailable' });
    await expect(runtime.stop()).rejects.toThrow(/cleanup failed closed/u);
  });
});
