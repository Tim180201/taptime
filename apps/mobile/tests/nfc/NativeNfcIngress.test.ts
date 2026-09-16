import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../modules/taptime-nfc-ingress', () => ({
  default: {
    hasPending: () => false,
    readPendingEvidence: () => null,
    consume: () => null,
    clear() {},
    closeProcessStartIntentWindow() {},
  },
}));
import {
  NativeNfcIngressCapturePort,
  NativeNfcIngressLifecycle,
} from '../../src/nfc/NativeNfcIngress';

describe('Native NFC ingress', () => {
  const pendingEvidence = Object.freeze({
    bootMarker: 'boot-a',
    intentOrigin: 'activity_delivery_intent' as const,
    processStartElapsedRealtimeMilliseconds: 10,
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

  it('fails closed when native process-start evidence is inconsistent', () => {
    const source = {
      hasPending: vi.fn(() => true),
      readPendingEvidence: vi.fn(() => ({
        ...pendingEvidence,
        intentOrigin: 'process_start_intent' as const,
        processStartElapsedRealtimeMilliseconds: 43,
      })),
      consume: vi.fn(() => null),
      clear: vi.fn(),
    };

    expect(new NativeNfcIngressCapturePort(source).readPendingEvidence()).toBeNull();
    expect(source.clear).toHaveBeenCalledOnce();
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
      bindNativeNfcIngressRuntimeStart: vi.fn(),
      unbindNativeNfcIngressRuntimeStart: vi.fn(),
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
    expect(authority.bindNativeNfcIngressRuntimeStart).toHaveBeenCalledOnce();
    expect(authority.unbindNativeNfcIngressRuntimeStart).toHaveBeenCalledOnce();
    expect(ingress.clear).toHaveBeenCalledOnce();
    expect(scan.scan).toHaveBeenCalledWith();
    expect(authority.captureNativeNfcIngressAuthority)
      .toHaveBeenCalledWith(pendingEvidence);
    expect(authority.isNativeNfcIngressAuthorityCurrent)
      .toHaveBeenCalledWith(authoritySnapshot);
  });

  it('processes the process-start Tag under the authority restored by that same start, because no earlier process-local authority can own it', async () => {
    let pending = true;
    const processStartEvidence = Object.freeze({
      bootMarker: 'boot-a',
      intentOrigin: 'process_start_intent' as const,
      processStartElapsedRealtimeMilliseconds: 50,
      elapsedRealtimeMilliseconds: 100,
    });
    const authoritySnapshot = Object.freeze({ generation: 2 });
    const ingress = {
      hasPending: vi.fn(() => pending),
      readPendingEvidence: vi.fn(() => pending ? processStartEvidence : null),
      clear: vi.fn(() => { pending = false; }),
    };
    const scan = { scan: vi.fn(async () => { pending = false; }) };
    const authority = {
      bindNativeNfcIngressRuntimeStart: vi.fn(),
      unbindNativeNfcIngressRuntimeStart: vi.fn(),
      captureNativeNfcIngressAuthority: vi.fn(async () => authoritySnapshot),
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

    // The coordinator owns the eligibility decision; this layer preserves its one-shot route.
    lifecycle.start();
    await Promise.resolve();
    expect(scan.scan).toHaveBeenCalledOnce();
    expect(ingress.clear).not.toHaveBeenCalled();
    expect(authority.captureNativeNfcIngressAuthority)
      .toHaveBeenCalledWith(processStartEvidence);
  });

  it('discards a pending Tag when the coordinator rejects its authority', async () => {
    const ingress = {
      hasPending: vi.fn(() => true),
      readPendingEvidence: vi.fn(() => pendingEvidence),
      clear: vi.fn(),
    };
    const scan = { scan: vi.fn(async () => undefined) };
    const authority = {
      bindNativeNfcIngressRuntimeStart: vi.fn(),
      unbindNativeNfcIngressRuntimeStart: vi.fn(),
      captureNativeNfcIngressAuthority: vi.fn(async () => null),
      isNativeNfcIngressAuthorityCurrent: vi.fn(() => false),
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

    // Boot, process, origin, and identity boundaries are real coordinator tests; this layer clears.
    lifecycle.start();
    await Promise.resolve();

    expect(ingress.clear).toHaveBeenCalledOnce();
    expect(scan.scan).not.toHaveBeenCalled();
  });

  it('clears a pending Tag when the captured authority is no longer current', async () => {
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
        bindNativeNfcIngressRuntimeStart() {},
        unbindNativeNfcIngressRuntimeStart() {},
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
  });

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
        bindNativeNfcIngressRuntimeStart() {},
        unbindNativeNfcIngressRuntimeStart() {},
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
        bindNativeNfcIngressRuntimeStart() {},
        unbindNativeNfcIngressRuntimeStart() {},
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
      source.indexOf('private fun stripNfcExtras'),
    );
    const stripping = source.slice(
      source.indexOf('private fun stripNfcExtras'),
      source.indexOf('fun consume'),
    );
    const stripCall = capture.indexOf('stripNfcExtras(intent)');
    const pendingExit = capture.indexOf('if (pending != null) return');
    const invalidUidExit = capture.indexOf('if (uid.isEmpty() || uid.size > 32) return');

    for (const extra of ['EXTRA_TAG', 'EXTRA_ID', 'EXTRA_NDEF_MESSAGES']) {
      const removal = stripping.indexOf(`intent.removeExtra(NfcAdapter.${extra})`);
      expect(removal).toBeGreaterThan(-1);
    }
    expect(stripCall).toBeGreaterThan(-1);
    expect(stripCall).toBeLessThan(pendingExit);
    expect(stripCall).toBeLessThan(invalidUidExit);
    expect(capture.match(/getParcelableExtra<Tag>/g)).toHaveLength(1);
    expect(capture.indexOf('tag?.id?.copyOf()')).toBeGreaterThan(pendingExit);
  });

  it('keeps restored queued newIntent eligible only until first post-resume', () => {
    const source = readFileSync(new URL(
      '../../modules/taptime-nfc-ingress/android/src/main/java/com/taptime/nfcingress/TapTimeNfcIngressModule.kt',
      import.meta.url,
    ), 'utf8');
    const activityCreate = source.slice(
      source.indexOf('fun captureActivityCreateIntent'),
      source.indexOf('fun captureActivityDeliveryIntent'),
    );
    const activityDelivery = source.slice(
      source.indexOf('fun captureActivityDeliveryIntent'),
      source.indexOf('fun closeProcessStartIntentWindow'),
    );
    const closeWindow = source.slice(
      source.indexOf('fun closeProcessStartIntentWindow'),
      source.indexOf('private fun claimProcessStartIntentOrigin'),
    );

    expect(activityCreate).toContain('isRestoredCreation && !isNfcIntent');
    expect(activityCreate).toContain('captureIntent(intent, claimProcessStartIntentOrigin())');
    expect(activityDelivery).toContain(
      'captureIntent(intent, claimProcessStartIntentOrigin())',
    );
    expect(closeWindow).toContain('processStartIntentWindowOpen = false');
  });

  it('closes process-start provenance before the known WorkManager headless path runs', () => {
    const source = readFileSync(new URL(
      '../../src/offline/registerOfflineBackgroundTask.ts',
      import.meta.url,
    ), 'utf8');
    const callback = source.slice(source.indexOf('TaskManager.defineTask'));

    expect(callback.indexOf('NativeNfcIngress.closeProcessStartIntentWindow()'))
      .toBeGreaterThan(-1);
    expect(callback.indexOf('NativeNfcIngress.closeProcessStartIntentWindow()'))
      .toBeLessThan(callback.indexOf('if (error !== null'));
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
    expect(evidenceFunction).toContain('"intentOrigin" to capture.intentOrigin');
    expect(evidenceFunction).toContain('"processStartElapsedRealtimeMilliseconds" to');
    expect(evidenceFunction).toContain(
      '"elapsedRealtimeMilliseconds" to capture.elapsedRealtimeMilliseconds.toDouble()',
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
