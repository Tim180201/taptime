import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../modules/taptime-nfc-ingress', () => ({
  default: { hasPending: () => false, consume: () => null, clear() {} },
}));
import {
  NativeNfcIngressCapturePort,
  NativeNfcIngressLifecycle,
} from '../../src/nfc/NativeNfcIngress';

describe('Native NFC ingress', () => {
  it('converts UID bytes and consumes a cold/warm Tag Dispatch capture once', () => {
    const source = {
      hasPending: vi.fn(() => true),
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
    const ingress = { hasPending: vi.fn(() => true), clear: vi.fn() };
    const scan = { scan: vi.fn(async () => undefined) };
    const lifecycle = new NativeNfcIngressLifecycle(
      ingress,
      scan,
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
    expect(scan.scan).toHaveBeenCalledTimes(2);
    lifecycle.stop();
    expect(ingress.clear).toHaveBeenCalledOnce();
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
});
