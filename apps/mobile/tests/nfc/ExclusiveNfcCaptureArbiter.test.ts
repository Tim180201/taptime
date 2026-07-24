import { describe, expect, it, vi } from 'vitest';
import type { NfcPayload, NfcScanCaptureResult, Timestamp } from '@taptime/core';
import { ExclusiveNfcCaptureArbiter } from '../../src/nfc/ExclusiveNfcCaptureArbiter';

function deferred() { let resolve!: (value: NfcScanCaptureResult) => void; const promise = new Promise<NfcScanCaptureResult>((done) => { resolve = done; }); return { promise, resolve }; }

describe('ExclusiveNfcCaptureArbiter', () => {
  it('gives one native capture to exactly one owner', async () => {
    const capture = deferred();
    const native = { checkCapability: vi.fn(async () => 'ready' as const), scan: vi.fn(() => capture.promise), cancelCapture: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) };
    const arbiter = new ExclusiveNfcCaptureArbiter(native);
    const lifecycle = arbiter.scope('lifecycle'); const administration = arbiter.scope('administration');
    const first = lifecycle.scan();
    await expect(administration.scan()).resolves.toEqual({ status: 'unavailable' });
    expect(native.scan).toHaveBeenCalledTimes(1);
    capture.resolve({ status: 'cancelled' }); await first;
  });

  it('does not let one owner cancel the other owner capture', async () => {
    const capture = deferred(); const native = { checkCapability: vi.fn(async () => 'ready' as const), scan: vi.fn(() => capture.promise), cancelCapture: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) };
    const arbiter = new ExclusiveNfcCaptureArbiter(native); const lifecycle = arbiter.scope('lifecycle'); const administration = arbiter.scope('administration');
    const active = administration.scan(); await lifecycle.cancelCapture(); expect(native.cancelCapture).not.toHaveBeenCalled();
    await administration.cancelCapture(); expect(native.cancelCapture).toHaveBeenCalledTimes(1); capture.resolve({ status: 'cancelled' }); await active;
  });

  it('reserves native Tag Dispatch ingress for lifecycle capture and never administration setup', async () => {
    const ingressCapture: NfcScanCaptureResult = {
      status: 'captured',
      payload: 'nfc:uid:v1:01020304' as NfcPayload,
      capturedAt: '2026-07-24T10:00:00.000Z' as Timestamp,
    };
    const ingress = { consume: vi.fn(() => ingressCapture) };
    const native = {
      checkCapability: vi.fn(async () => 'ready' as const),
      scan: vi.fn(async (): Promise<NfcScanCaptureResult> => ({
        status: 'captured',
        payload: 'nfc:uid:v1:AABBCCDD' as NfcPayload,
      })),
      cancelCapture: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
    };
    const arbiter = new ExclusiveNfcCaptureArbiter(native, ingress);

    await expect(arbiter.scope('administration').scan()).resolves.toEqual({
      status: 'captured',
      payload: 'nfc:uid:v1:AABBCCDD',
    });
    expect(ingress.consume).not.toHaveBeenCalled();

    await expect(arbiter.scope('lifecycle').scan()).resolves.toEqual(ingressCapture);
    expect(ingress.consume).toHaveBeenCalledOnce();
    expect(native.scan).toHaveBeenCalledOnce();
  });
});
