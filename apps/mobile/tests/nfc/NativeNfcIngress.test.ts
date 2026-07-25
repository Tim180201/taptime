import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../modules/taptime-nfc-ingress', () => ({
  default: {
    hasPending: () => false,
    readPendingEvidence: () => null,
    consume: () => null,
    clear() {},
  },
}));
import {
  NativeNfcIngressCapturePort,
  NativeNfcIngressLifecycle,
} from '../../src/nfc/NativeNfcIngress';

describe('Native NFC ingress', () => {
  const pendingEvidence = Object.freeze({
    bootMarker: 'boot-a',
    elapsedRealtimeMilliseconds: 42,
  });

  it('keeps the tracked native module on the Expo 57 Gradle contract', () => {
    const source = readFileSync(new URL(
      '../../modules/taptime-nfc-ingress/android/build.gradle',
      import.meta.url,
    ), 'utf8');

    expect(source).toMatch(
      /plugins\s*\{\s*id 'com\.android\.library'\s*id 'expo-module-gradle-plugin'\s*\}/,
    );
    expect(source.match(/^group = 'com\.taptime\.nfcingress'$/gm)).toHaveLength(1);
    expect(source.match(/^version = '1\.0\.0'$/gm)).toHaveLength(1);
    expect(source.match(/^\s*namespace "com\.taptime\.nfcingress"$/gm)).toHaveLength(1);
    expect(source.match(/^\s*minSdkVersion 24$/gm)).toHaveLength(1);
    expect(source.match(/^\s*versionName "1\.0\.0"$/gm)).toHaveLength(1);
    expect(source).not.toMatch(/safeExtGet|apply\s+plugin|kotlin-android/);
    expect(source).not.toMatch(/\btargetSdk(?:Version)?\b/);
  });

  it('converts UID bytes and consumes a cold/warm Tag Dispatch capture once', () => {
    const source = {
      hasPending: vi.fn(() => true),
      readPendingEvidence: vi.fn(() => pendingEvidence),
      consume: vi.fn()
        .mockReturnValueOnce({
          uid: [0x01, 0xab, 0xff],
          wallClockMilliseconds: Date.parse('2026-07-24T10:00:00.000Z'),
          elapsedRealtimeMilliseconds: 42,
        })
        .mockReturnValueOnce(null),
      clear: vi.fn(),
    };
    const port = new NativeNfcIngressCapturePort(source);
    expect(port.consume()).toEqual({
      status: 'captured',
      payload: 'nfc:uid:v1:01ABFF',
      capturedAt: '2026-07-24T10:00:00.000Z',
    });
    expect(port.consume()).toBeNull();
  });

  it('routes a pending capture through the product scan capability', async () => {
    const timer: { callback?: () => void } = {};
    let pending = true;
    const authoritySnapshot = Object.freeze({ generation: 7 });
    const ingress = {
      hasPending: vi.fn(() => pending),
      readPendingEvidence: vi.fn(() => pending ? pendingEvidence : null),
      clear: vi.fn(() => { pending = false; }),
    };
    const scan = {
      scan: vi.fn(async () => { pending = false; }),
    };
    const authority = {
      captureNativeNfcIngressAuthority: vi.fn(async () => authoritySnapshot),
      isNativeNfcIngressAuthorityCurrent: vi.fn(() => true),
    };
    const lifecycle = new NativeNfcIngressLifecycle(
      ingress,
      scan,
      authority,
      ((next: () => void) => {
        timer.callback = next;
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      vi.fn() as typeof clearInterval,
    );
    lifecycle.start();
    await Promise.resolve();
    expect(scan.scan).toHaveBeenCalledTimes(1);
    timer.callback?.();
    await Promise.resolve();
    expect(scan.scan).toHaveBeenCalledTimes(1);
    lifecycle.stop();
    expect(ingress.clear).toHaveBeenCalledOnce();
    expect(scan.scan).toHaveBeenCalledWith();
    expect(authority.captureNativeNfcIngressAuthority)
      .toHaveBeenCalledWith(pendingEvidence);
    expect(authority.isNativeNfcIngressAuthorityCurrent)
      .toHaveBeenCalledWith(authoritySnapshot);
  });

  it('discards a Tag captured before new authority when its first poll is after login-ready', async () => {
    let pending = true;
    const preLoginEvidence = Object.freeze({
      bootMarker: 'boot-a',
      elapsedRealtimeMilliseconds: 100,
    });
    const authoritySnapshot = Object.freeze({
      generation: 2,
      validFromBootMarker: 'boot-a',
      validFromElapsedRealtimeMilliseconds: 200,
    });
    const ingress = {
      hasPending: vi.fn(() => pending),
      readPendingEvidence: vi.fn(() => pending ? preLoginEvidence : null),
      clear: vi.fn(() => { pending = false; }),
    };
    const scan = { scan: vi.fn(async () => { pending = false; }) };
    const authority = {
      captureNativeNfcIngressAuthority: vi.fn(async (evidence: typeof preLoginEvidence) => (
        evidence.bootMarker === authoritySnapshot.validFromBootMarker
        && evidence.elapsedRealtimeMilliseconds
          >= authoritySnapshot.validFromElapsedRealtimeMilliseconds
          ? authoritySnapshot
          : null
      )),
      isNativeNfcIngressAuthorityCurrent: vi.fn(
        (candidate) => candidate === authoritySnapshot,
      ),
    };
    const lifecycle = new NativeNfcIngressLifecycle(
      ingress,
      scan,
      authority,
      vi.fn(() => (
        1 as unknown as ReturnType<typeof setInterval>
      )) as unknown as typeof setInterval,
      vi.fn() as typeof clearInterval,
    );

    // The native slot predates login; the lifecycle starts only after login is ready.
    lifecycle.start();
    await Promise.resolve();
    expect(ingress.clear).toHaveBeenCalledOnce();
    expect(scan.scan).not.toHaveBeenCalled();
    expect(authority.captureNativeNfcIngressAuthority)
      .toHaveBeenCalledWith(preLoginEvidence);
  });

  it.each(['sign-out', 'session replacement', 'Membership mismatch', 'runtime generation'])(
    'clears a pending Tag when %s invalidates the captured authority',
    async () => {
      const authoritySnapshot = Object.freeze({ generation: 3 });
      const ingress = {
        hasPending: vi.fn(() => true),
        readPendingEvidence: vi.fn(() => pendingEvidence),
        clear: vi.fn(),
      };
      const scan = { scan: vi.fn(async () => undefined) };
      const lifecycle = new NativeNfcIngressLifecycle(
        ingress,
        scan,
        {
          captureNativeNfcIngressAuthority: async () => authoritySnapshot,
          isNativeNfcIngressAuthorityCurrent: () => false,
        },
        vi.fn(() => (
          1 as unknown as ReturnType<typeof setInterval>
        )) as unknown as typeof setInterval,
        vi.fn() as typeof clearInterval,
      );

      lifecycle.start();
      await Promise.resolve();

      expect(ingress.clear).toHaveBeenCalledOnce();
      expect(scan.scan).not.toHaveBeenCalled();
    },
  );

  it('consumes one pending Tag under the exact current offline-restoration authority', async () => {
    const timer: { callback?: () => void } = {};
    let pending = true;
    const restorationAuthority = Object.freeze({
      generation: 4,
      restorationRevision: 9,
      source: 'provider_suspended',
    });
    const ingress = {
      hasPending: vi.fn(() => pending),
      readPendingEvidence: vi.fn(() => pending ? pendingEvidence : null),
      clear: vi.fn(() => { pending = false; }),
    };
    const scan = { scan: vi.fn(async () => { pending = false; }) };
    const lifecycle = new NativeNfcIngressLifecycle(
      ingress,
      scan,
      {
        captureNativeNfcIngressAuthority: async () => restorationAuthority,
        isNativeNfcIngressAuthorityCurrent: (candidate) => candidate === restorationAuthority,
      },
      ((next: () => void) => {
        timer.callback = next;
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      vi.fn() as typeof clearInterval,
    );

    lifecycle.start();
    await Promise.resolve();
    timer.callback?.();
    await Promise.resolve();

    expect(scan.scan).toHaveBeenCalledOnce();
    expect(scan.scan).toHaveBeenCalledWith();
    expect(JSON.stringify(restorationAuthority)).not.toMatch(/uid|nfc:uid|tag/i);
  });

  it('waits only the exact cold restoration attempt before consuming or discarding', async () => {
    const restoration = deferred<object | null>();
    let pending = true;
    let laterAuthority: object | null = null;
    const ingress = {
      hasPending: vi.fn(() => pending),
      readPendingEvidence: vi.fn(() => pending ? pendingEvidence : null),
      clear: vi.fn(() => { pending = false; }),
    };
    const scan = { scan: vi.fn(async () => { pending = false; }) };
    const lifecycle = new NativeNfcIngressLifecycle(
      ingress,
      scan,
      {
        captureNativeNfcIngressAuthority: () => restoration.promise,
        isNativeNfcIngressAuthorityCurrent: (candidate) => candidate === laterAuthority,
      },
      vi.fn(() => (
        1 as unknown as ReturnType<typeof setInterval>
      )) as unknown as typeof setInterval,
      vi.fn() as typeof clearInterval,
    );

    lifecycle.start();
    await Promise.resolve();
    expect(ingress.clear).not.toHaveBeenCalled();
    expect(scan.scan).not.toHaveBeenCalled();

    restoration.resolve(null);
    await vi.waitFor(() => expect(ingress.clear).toHaveBeenCalledOnce());
    laterAuthority = Object.freeze({ generation: 8 });
    await Promise.resolve();
    expect(scan.scan).not.toHaveBeenCalled();
  });

  it('strips every Android NFC reference before duplicate or invalid-UID exits', () => {
    const source = readFileSync(new URL(
      '../../modules/taptime-nfc-ingress/android/src/main/java/com/taptime/nfcingress/TapTimeNfcIngressModule.kt',
      import.meta.url,
    ), 'utf8');
    const capture = source.slice(
      source.indexOf('fun captureIntent'),
      source.indexOf('fun consume'),
    );
    const pendingExit = capture.indexOf('if (pending != null) return');
    const invalidUidExit = capture.indexOf('if (uid.isEmpty() || uid.size > 32) return');

    for (const extra of ['EXTRA_TAG', 'EXTRA_ID', 'EXTRA_NDEF_MESSAGES']) {
      const removal = capture.indexOf(`intent.removeExtra(NfcAdapter.${extra})`);
      expect(removal).toBeGreaterThan(-1);
      expect(removal).toBeLessThan(pendingExit);
      expect(removal).toBeLessThan(invalidUidExit);
    }
    expect(capture.match(/getParcelableExtra<Tag>/g)).toHaveLength(1);
    expect(capture.indexOf('tag?.id?.copyOf()')).toBeGreaterThan(pendingExit);
  });

  it('exposes capture-time authority evidence without exposing the raw UID', () => {
    const source = readFileSync(new URL(
      '../../modules/taptime-nfc-ingress/android/src/main/java/com/taptime/nfcingress/TapTimeNfcIngressModule.kt',
      import.meta.url,
    ), 'utf8');
    const evidenceFunction = source.slice(
      source.indexOf('Function("readPendingEvidence")'),
      source.indexOf('Function("clear")'),
    );

    expect(evidenceFunction).toContain('"bootMarker" to bootMarker');
    expect(evidenceFunction).toContain(
      '"elapsedRealtimeMilliseconds" to elapsedRealtimeMilliseconds.toDouble()',
    );
    expect(evidenceFunction).not.toMatch(/uid|wallClock/i);
  });
});

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
