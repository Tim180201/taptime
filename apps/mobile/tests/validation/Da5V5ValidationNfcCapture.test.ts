import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Da5V5ValidationCaptureFailureStage,
} from '../../src/validation/Da5V5ValidationContract';

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

function failed(failureStage: Da5V5ValidationCaptureFailureStage) {
  return {
    status: 'failed',
    failureStage,
  } as const;
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

  it('accepts an Android-reported Technology superset without exposing its extras', async () => {
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    discover({
      id: '04a1b2c3',
      techTypes: [
        'android.nfc.tech.NfcA',
        'android.nfc.tech.IsoDep',
        'android.nfc.tech.MifareUltralight',
        'android.nfc.tech.Ndef',
        'android.nfc.tech.NfcA',
        'android.nfc.tech.NfcB',
      ],
    });
    await expect(result).resolves.toEqual({
      status: 'captured',
      fingerprint: 'AAAAAAAAAAAA',
      technology: 'NfcA',
    });
    expect(JSON.stringify(await result)).not.toMatch(
      /IsoDep|Ndef|NfcB|android\.nfc\.tech/u,
    );
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
    ['android.nfc.tech.MifareUltralight'],
    ['android.nfc.tech.IsoDep'],
    [
      'android.nfc.tech.MifareUltralight',
      'android.nfc.tech.IsoDep',
    ],
  ])('rejects Technology evidence missing NfcA %#', (technology) => {
    expect(hasAllowedTechnologyEvidence(technology)).toBe(false);
  });

  it('accepts NfcA plus duplicated or additional Android technologies', () => {
    expect(hasAllowedTechnologyEvidence([
      'android.nfc.tech.NfcA',
    ])).toBe(true);
    expect(hasAllowedTechnologyEvidence([
      'android.nfc.tech.NfcA',
      'android.nfc.tech.NfcA',
      'android.nfc.tech.MifareUltralight',
    ])).toBe(true);
  });

  it('ignores arbitrary, duplicated and previously length-limited extras', () => {
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
    ])).toBe(true);
    expect(hasAllowedTechnologyEvidence([
      'android.nfc.tech.NfcA',
      'android.nfc.tech.IsoDep',
      'android.nfc.tech.MifareUltralight',
      'android.nfc.tech.NfcA',
      'android.nfc.tech.NfcB',
      'android.nfc.tech.Ndef',
    ])).toBe(true);
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
        'android.nfc.tech.MifareUltralight',
        'android.nfc.tech.Ndef',
      ],
    });
    await expect(result).resolves.toEqual({
      status: 'failed',
      failureStage: 'technology_evidence',
    });
    expect(digest).not.toHaveBeenCalled();
  });

  it.each([
    { id: undefined },
    { id: '0' },
    { id: 'not-hex' },
  ])('maps unreadable UID evidence to one fixed stage %#', async (tag) => {
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    discover({
      ...tag,
      techTypes: [
        'android.nfc.tech.NfcA',
        'android.nfc.tech.MifareUltralight',
      ],
    });
    await expect(result).resolves.toEqual(failed('uid_readability'));
  });

  it('maps listener setup failure without retaining exception text', async () => {
    nativeManager.setEventListener.mockImplementationOnce(() => {
      throw new Error(
        'raw uid 04A1B2C3 payload secret native listener detail',
      );
    });
    const result = await capture().capture();
    expect(result).toEqual(failed('listener_registration'));
    expect(JSON.stringify(result)).not.toMatch(
      /04A1B2C3|payload secret|native listener detail/u,
    );
  });

  it('maps an asynchronous registration rejection after discovery', async () => {
    let rejectRegistration!: (error: Error) => void;
    nativeManager.registerTagEvent.mockImplementation(() => (
      new Promise<void>((_resolve, reject) => {
        rejectRegistration = reject;
      })
    ));
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    discover({
      id: '04A1B2C3',
      techTypes: [
        'android.nfc.tech.NfcA',
        'android.nfc.tech.MifareUltralight',
      ],
    });
    rejectRegistration(new Error(
      'raw uid 04A1B2C3 payload secret registration detail',
    ));
    await expect(result).resolves.toEqual(
      failed('listener_registration'),
    );
    expect(JSON.stringify(await result)).not.toMatch(
      /04A1B2C3|payload secret|registration detail/u,
    );
  });

  it('maps digest rejection and invalid digest output to one fixed stage', async () => {
    for (const digestCanonicalPayload of [
      vi.fn(async () => Promise.reject(
        new Error('raw uid 04A1B2C3 digest provider detail'),
      )),
      vi.fn(async () => 'not-a-sha-256-digest'),
    ]) {
      const runtime = new Da5V5ValidationNfcCapture({
        manager: nativeManager,
        platform: 'android',
        digestCanonicalPayload,
      });
      const result = runtime.capture();
      await vi.waitFor(() => {
        expect(nativeManager.registerTagEvent).toHaveBeenCalled();
      });
      discover({
        id: '04A1B2C3',
        techTypes: [
          'android.nfc.tech.NfcA',
          'android.nfc.tech.MifareUltralight',
        ],
      });
      await expect(result).resolves.toEqual(failed('digest'));
      expect(JSON.stringify(await result)).not.toMatch(
        /04A1B2C3|provider detail|not-a-sha/u,
      );
      vi.clearAllMocks();
      nativeManager.registerTagEvent.mockResolvedValue(undefined);
      nativeManager.start.mockResolvedValue(undefined);
      nativeManager.unregisterTagEvent.mockResolvedValue(undefined);
    }
  });

  it('rejects a concurrent direct capture and cleans the active listener', async () => {
    const runtime = capture();
    const first = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    await expect(runtime.capture()).resolves.toEqual({
      status: 'failed',
      failureStage: 'concurrency',
    });
    await runtime.cancelCapture();
    await expect(first).resolves.toEqual({ status: 'cancelled' });
    expect(nativeManager.unregisterTagEvent).toHaveBeenCalledTimes(1);
  });

  it('signals unregister failure to cancellation while settling capture as cleanup failure', async () => {
    nativeManager.unregisterTagEvent.mockRejectedValue(
      new Error('synthetic unregister failure'),
    );
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });

    await expect(runtime.cancelCapture()).rejects.toThrow(
      /cancellation cleanup failed closed/u,
    );
    await expect(result).resolves.toEqual(failed('cleanup'));
  });

  it('signals bounded cleanup timeout to cancellation without wedging capture', async () => {
    let cleanupTimeout: (() => void) | undefined;
    nativeManager.unregisterTagEvent.mockImplementation(
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
    const cancellation = runtime.cancelCapture();
    await vi.waitFor(() => {
      expect(cleanupTimeout).toBeTypeOf('function');
    });

    cleanupTimeout!();
    await expect(cancellation).rejects.toThrow(
      /cancellation cleanup failed closed/u,
    );
    await expect(result).resolves.toEqual(failed('cleanup'));
  });

  it('claims the first native event synchronously and rejects a second before the first digest settles', async () => {
    let releaseFirstDigest!: (digest: string) => void;
    const digestCanonicalPayload = vi.fn(() => (
      new Promise<string>((resolve) => {
        releaseFirstDigest = resolve;
      })
    ));
    const runtime = new Da5V5ValidationNfcCapture({
      manager: nativeManager,
      platform: 'android',
      digestCanonicalPayload,
    });
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    discover({
      id: '04A1B2C3',
      techTypes: ['android.nfc.tech.NfcA'],
    });
    discover({
      id: '04FFFFFFFF',
      techTypes: ['android.nfc.tech.NfcA'],
    });

    await expect(result).resolves.toEqual(failed('concurrency'));
    expect(digestCanonicalPayload).toHaveBeenCalledTimes(1);
    releaseFirstDigest('b'.repeat(64));
    await Promise.resolve();
    await expect(result).resolves.toEqual(failed('concurrency'));
  });

  it('preserves cancellation when registration rejects after the terminal result', async () => {
    let rejectRegistration!: (error: Error) => void;
    nativeManager.registerTagEvent.mockImplementation(() => (
      new Promise<void>((_resolve, reject) => {
        rejectRegistration = reject;
      })
    ));
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    const cancellation = runtime.cancelCapture();
    rejectRegistration(new Error('late registration rejection'));
    await expect(cancellation).resolves.toBeUndefined();
    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });

  it('cancels while native startup is pending without registering a late listener', async () => {
    let releaseStart!: () => void;
    nativeManager.start.mockImplementation(() => (
      new Promise<void>((resolve) => {
        releaseStart = resolve;
      })
    ));
    const runtime = capture();
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.start).toHaveBeenCalledTimes(1);
    });
    await expect(runtime.cancelCapture()).resolves.toBeUndefined();
    releaseStart();
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    expect(nativeManager.registerTagEvent).not.toHaveBeenCalled();
  });

  it('keeps second-event concurrency terminal when registration rejects later', async () => {
    let rejectRegistration!: (error: Error) => void;
    let releaseFirstDigest!: (digest: string) => void;
    nativeManager.registerTagEvent.mockImplementation(() => (
      new Promise<void>((_resolve, reject) => {
        rejectRegistration = reject;
      })
    ));
    const runtime = new Da5V5ValidationNfcCapture({
      manager: nativeManager,
      platform: 'android',
      digestCanonicalPayload: vi.fn(() => (
        new Promise<string>((resolve) => {
          releaseFirstDigest = resolve;
        })
      )),
    });
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    discover({
      id: '04A1B2C3',
      techTypes: ['android.nfc.tech.NfcA'],
    });
    discover({
      id: '04FFFFFFFF',
      techTypes: ['android.nfc.tech.NfcA'],
    });
    rejectRegistration(new Error('late registration rejection'));
    await expect(result).resolves.toEqual(failed('concurrency'));
    releaseFirstDigest('c'.repeat(64));
  });

  it('preserves the fixed capture timeout and cleanup behavior', async () => {
    let captureTimeout!: () => void;
    const clearScheduledTimeout = vi.fn();
    const runtime = new Da5V5ValidationNfcCapture({
      manager: nativeManager,
      platform: 'android',
      digestCanonicalPayload: vi.fn(async () => 'a'.repeat(64)),
      scheduleTimeout: (callback) => {
        captureTimeout = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearScheduledTimeout,
    });
    const result = runtime.capture();
    await vi.waitFor(() => {
      expect(nativeManager.registerTagEvent).toHaveBeenCalledTimes(1);
    });
    captureTimeout();
    await expect(result).resolves.toEqual({ status: 'timed_out' });
    expect(clearScheduledTimeout).toHaveBeenCalledTimes(1);
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
    await expect(result).resolves.toEqual(failed('cleanup'));
    await expect(runtime.capture()).resolves.toEqual({
      status: 'failed',
      failureStage: 'cleanup',
    });
  });

  it('reports fixed post-result cleanup stage without exception text', async () => {
    nativeManager.unregisterTagEvent.mockRejectedValue(
      new Error(
        'raw uid 04A1B2C3 payload secret native unregister detail',
      ),
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
    await expect(result).resolves.toEqual(failed('cleanup'));
    expect(JSON.stringify(await result)).not.toMatch(
      /04A1B2C3|payload secret|native unregister detail/u,
    );
    await expect(runtime.stop()).rejects.toThrow(/cleanup failed closed/u);
  });
});
