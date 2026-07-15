import { describe, expect, it, vi } from 'vitest';
import type { NfcScanCaptureResult } from '@taptime/core';
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
});
