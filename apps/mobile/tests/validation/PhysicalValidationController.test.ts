import { describe, expect, it, vi } from 'vitest';
import type { NfcScanCaptureResult, NfcScanPort } from '@taptime/core';
import type { NfcCaptureLifecyclePort } from '../../src/nfc/RnNfcScanAdapter';
import { PhysicalValidationController } from '../../src/validation/PhysicalValidationController';

function harness(results: NfcScanCaptureResult[]) {
  const scan = vi.fn(async () => results.shift() ?? { status: 'timed_out' } as const);
  const scanner: NfcScanPort = { scan };
  const lifecycle: NfcCaptureLifecyclePort = {
    checkCapability: vi.fn(async () => 'ready' as const), cancelCapture: vi.fn(async () => undefined), stop: vi.fn(async () => undefined),
  };
  const controller = new PhysicalValidationController(scanner, lifecycle, async (value) => `HASH-${value.slice(-2)}`);
  return { controller, scan, lifecycle };
}

describe('PhysicalValidationController', () => {
  it('counts stable scans and isolates the two tag slots without retaining payloads', async () => {
    const { controller } = harness([
      { status: 'captured', payload: 'nfc:uid:v1:AABB' as never },
      { status: 'captured', payload: 'nfc:uid:v1:AABB' as never },
      { status: 'captured', payload: 'nfc:uid:v1:CCDD' as never },
    ]);
    await controller.start();
    await controller.scan();
    await controller.scan();
    controller.selectSlot('B');
    await controller.scan();
    expect(controller.getState().slots).toEqual({
      A: { count: 2, fingerprint: 'HASH-BB', mismatches: 0 },
      B: { count: 1, fingerprint: 'HASH-DD', mismatches: 0 },
    });
    expect(JSON.stringify(controller.getState())).not.toContain('nfc:uid');
  });

  it('flags a changed fingerprint and does not count it as stable', async () => {
    const { controller } = harness([
      { status: 'captured', payload: 'nfc:uid:v1:AABB' as never },
      { status: 'captured', payload: 'nfc:uid:v1:CCDD' as never },
    ]);
    await controller.start();
    await controller.scan();
    await controller.scan();
    expect(controller.getState().slots.A).toEqual({ count: 1, fingerprint: 'HASH-BB', mismatches: 1 });
    expect(controller.getState().outcome).toBe('mismatch');
  });

  it('coalesces rapid duplicate scan requests and delegates cancellation', async () => {
    let release!: (result: NfcScanCaptureResult) => void;
    const scanner = { scan: vi.fn(() => new Promise<NfcScanCaptureResult>((resolve) => { release = resolve; })) };
    const lifecycle: NfcCaptureLifecyclePort = { checkCapability: vi.fn(async () => 'ready' as const), cancelCapture: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) };
    const controller = new PhysicalValidationController(scanner, lifecycle, async () => 'HASH');
    await controller.start();
    const first = controller.scan();
    const second = controller.scan();
    expect(scanner.scan).toHaveBeenCalledTimes(1);
    await controller.cancel();
    expect(lifecycle.cancelCapture).toHaveBeenCalledTimes(1);
    release({ status: 'cancelled' });
    await Promise.all([first, second]);
    expect(controller.getState().outcome).toBe('cancelled');
  });
});
