import { describe, expect, it, vi } from 'vitest';
import {
  DA5_V5_VALIDATION_FAILURE_MESSAGES,
  DA5_V5_VALIDATION_FAILURE_REASON_BY_CAPTURE_STAGE,
  DA5_V5_VALIDATION_FAILURE_REASONS,
  DA5_V5_VALIDATION_STABLE_READS,
  Da5V5ValidationController,
  Da5V5ValidationUiActionBoundary,
  type Da5V5ValidationRole,
} from '../../src/validation/Da5V5ValidationController';
import type {
  Da5V5ValidationCapturePort,
  Da5V5ValidationCaptureResult,
} from '../../src/validation/Da5V5ValidationContract';
import type {
  Da5V5ValidationDeviceBinding,
  Da5V5ValidationDeviceBindingPort,
} from '../../src/validation/Da5V5ValidationDeviceBinding';

const technology = 'NfcA+MifareUltralight' as const;
const fingerprints = {
  A: 'AAAAAAAAAAAA',
  B: 'BBBBBBBBBBBB',
  X: 'CCCCCCCCCCCC',
} as const;
const deviceBinding: Da5V5ValidationDeviceBinding = {
  androidApiLevel: 35,
  androidBuild:
    'samsung/a33xeea/a33x:15/AP3A.240905.015.A2/A336BXXU9EYA1:user/release-keys',
  androidRelease: '15',
  deviceModel: 'SM-A336B',
  fontScale: 2,
  talkBackEnabled: true,
  talkBackPackageName: 'com.google.android.marvin.talkback',
  talkBackPackageVersion: '15.1.0',
};

function harness(
  results: Da5V5ValidationCaptureResult[] = [],
  bindingResult: unknown = deviceBinding,
) {
  const capture = vi.fn(async () => (
    results.shift() ?? { status: 'timed_out' } as const
  ));
  const port: Da5V5ValidationCapturePort = {
    cancelCapture: vi.fn(async () => undefined),
    capture,
    checkCapability: vi.fn(async () => 'ready' as const),
    stop: vi.fn(async () => undefined),
  };
  const bindingPort: Da5V5ValidationDeviceBindingPort = {
    readBinding: vi.fn(async () => bindingResult),
  };
  return {
    capture,
    controller: new Da5V5ValidationController(port, bindingPort),
    bindingPort,
    port,
  };
}

async function startReady(
  controller: Da5V5ValidationController,
): Promise<void> {
  await controller.start();
  expect(controller.getState()).toMatchObject({
    deviceBinding,
    phase: 'device_checkpoint',
  });
  controller.confirmDeviceBinding();
  expect(controller.getState().phase).toBe('ready');
}

function captured(role: Da5V5ValidationRole): Da5V5ValidationCaptureResult {
  return {
    status: 'captured',
    fingerprint: fingerprints[role],
    technology,
  };
}

describe('DA5 V5 A/B/X validation controller', () => {
  it('requires stable sequential and distinct proof for A, B and X', async () => {
    const results = (['A', 'B', 'X'] as const).flatMap((role) => (
      Array.from(
        { length: DA5_V5_VALIDATION_STABLE_READS },
        () => captured(role),
      )
    ));
    const { controller } = harness(results);
    await startReady(controller);
    for (const role of ['A', 'B', 'X'] as const) {
      for (
        let index = 0;
        index < DA5_V5_VALIDATION_STABLE_READS;
        index += 1
      ) {
        await controller.captureRole(role);
      }
    }

    expect(controller.getState()).toMatchObject({
      activeRole: 'X',
      phase: 'complete',
      slots: {
        A: {
          fingerprint: fingerprints.A,
          technology,
          progress: DA5_V5_VALIDATION_STABLE_READS,
        },
        B: {
          fingerprint: fingerprints.B,
          technology,
          progress: DA5_V5_VALIDATION_STABLE_READS,
        },
        X: {
          fingerprint: fingerprints.X,
          technology,
          progress: DA5_V5_VALIDATION_STABLE_READS,
        },
      },
    });
    expect(JSON.stringify(controller.getState())).not.toMatch(
      /nfc:uid|android\.nfc\.tech|techTypes|payload/u,
    );
  });

  it('fails closed on out-of-order capture before calling native capture', async () => {
    const { controller, capture } = harness();
    await startReady(controller);
    await controller.captureRole('B');
    expect(controller.getState().phase).toBe('failed');
    expect(controller.getState().outcome).toBe('failed_closed');
    expect(capture).not.toHaveBeenCalled();
  });

  it('fails closed on an unstable same-role fingerprint', async () => {
    const { controller } = harness([
      captured('A'),
      {
        status: 'captured',
        fingerprint: fingerprints.B,
        technology,
      },
    ]);
    await startReady(controller);
    await controller.captureRole('A');
    await controller.captureRole('A');
    expect(controller.getState().phase).toBe('failed');
    expect(controller.getState().slots.A.progress).toBe(1);
  });

  it('fails closed when a fingerprint is reused across roles', async () => {
    const results = [
      ...Array.from(
        { length: DA5_V5_VALIDATION_STABLE_READS },
        () => captured('A'),
      ),
      captured('A'),
    ];
    const { controller } = harness(results);
    await startReady(controller);
    for (
      let index = 0;
      index < DA5_V5_VALIDATION_STABLE_READS;
      index += 1
    ) {
      await controller.captureRole('A');
    }
    await controller.captureRole('B');
    expect(controller.getState().phase).toBe('failed');
    expect(controller.getState().slots.B.progress).toBe(0);
  });

  it('fails closed and cancels on concurrent capture', async () => {
    let release!: (result: Da5V5ValidationCaptureResult) => void;
    const deferred = new Promise<Da5V5ValidationCaptureResult>((resolve) => {
      release = resolve;
    });
    const { controller, port } = harness();
    vi.mocked(port.capture).mockReturnValue(deferred);
    await startReady(controller);
    const first = controller.captureRole('A');
    const second = controller.captureRole('A');
    expect(controller.getState().phase).toBe('failed');
    expect(port.cancelCapture).toHaveBeenCalledTimes(1);
    release({ status: 'cancelled' });
    await Promise.all([first, second]);
    expect(controller.getState().phase).toBe('failed');
  });

  it('coalesces repeated device confirmation only at the UI boundary', async () => {
    const { controller } = harness();
    await controller.start();
    const actions = new Da5V5ValidationUiActionBoundary(controller);

    actions.confirmDeviceBinding();
    actions.confirmDeviceBinding();

    expect(controller.getState()).toMatchObject({
      phase: 'ready',
      failureReason: null,
    });
  });

  it('keeps repeated direct Controller confirmation strict fail-closed', async () => {
    const { controller } = harness();
    await controller.start();

    controller.confirmDeviceBinding();
    controller.confirmDeviceBinding();

    expect(controller.getState()).toMatchObject({
      phase: 'failed',
      failureReason: 'operation_order_rejected',
    });
  });

  it('coalesces only the same active UI scan while it is in flight', async () => {
    let release!: (result: Da5V5ValidationCaptureResult) => void;
    const deferred = new Promise<Da5V5ValidationCaptureResult>((resolve) => {
      release = resolve;
    });
    const { controller, port } = harness();
    vi.mocked(port.capture).mockReturnValue(deferred);
    await startReady(controller);
    const actions = new Da5V5ValidationUiActionBoundary(controller);
    const firstOffer = controller.getState().uiRevision;

    const first = actions.captureRole('A', firstOffer);
    const duplicate = actions.captureRole('A', firstOffer);

    expect(duplicate).toBe(first);
    expect(port.capture).toHaveBeenCalledTimes(1);
    expect(port.cancelCapture).not.toHaveBeenCalled();

    release(captured('A'));
    await Promise.all([first, duplicate]);
    expect(controller.getState()).toMatchObject({
      phase: 'ready',
      slots: { A: { progress: 1 } },
    });

    await actions.captureRole('A', firstOffer);
    expect(port.capture).toHaveBeenCalledTimes(1);
    expect(controller.getState().slots.A.progress).toBe(1);

    vi.mocked(port.capture).mockResolvedValueOnce(captured('A'));
    const nextOffer = controller.getState().uiRevision;
    await actions.captureRole('A', nextOffer);
    expect(port.capture).toHaveBeenCalledTimes(2);
    expect(controller.getState().slots.A.progress).toBe(2);
  });

  it('permits all ten deliberate A scans through ten distinct UI offers', async () => {
    const { controller, port } = harness(Array.from(
      { length: DA5_V5_VALIDATION_STABLE_READS },
      () => captured('A'),
    ));
    await startReady(controller);
    const actions = new Da5V5ValidationUiActionBoundary(controller);

    for (
      let index = 0;
      index < DA5_V5_VALIDATION_STABLE_READS;
      index += 1
    ) {
      await actions.captureRole(
        'A',
        controller.getState().uiRevision,
      );
    }

    expect(port.capture).toHaveBeenCalledTimes(
      DA5_V5_VALIDATION_STABLE_READS,
    );
    expect(controller.getState()).toMatchObject({
      activeRole: 'B',
      phase: 'ready',
      slots: {
        A: { progress: DA5_V5_VALIDATION_STABLE_READS },
      },
    });
  });

  it('delegates a foreign in-flight UI scan to strict fail-closed concurrency', async () => {
    let release!: (result: Da5V5ValidationCaptureResult) => void;
    const deferred = new Promise<Da5V5ValidationCaptureResult>((resolve) => {
      release = resolve;
    });
    const { controller, port } = harness();
    vi.mocked(port.capture).mockReturnValue(deferred);
    await startReady(controller);
    const actions = new Da5V5ValidationUiActionBoundary(controller);
    const offer = controller.getState().uiRevision;

    const first = actions.captureRole('A', offer);
    const foreign = actions.captureRole('B', offer);

    expect(controller.getState()).toMatchObject({
      phase: 'failed',
      failureReason: 'operation_order_rejected',
    });
    expect(port.capture).toHaveBeenCalledTimes(1);
    expect(port.cancelCapture).toHaveBeenCalledTimes(1);

    release({ status: 'cancelled' });
    await Promise.all([first, foreign]);
    expect(controller.getState().phase).toBe('failed');
  });

  it('rejects a stale Reset handler during an active UI scan without reset cleanup', async () => {
    let release!: (result: Da5V5ValidationCaptureResult) => void;
    const deferred = new Promise<Da5V5ValidationCaptureResult>((resolve) => {
      release = resolve;
    });
    const { controller, port } = harness();
    vi.mocked(port.capture).mockReturnValue(deferred);
    await startReady(controller);
    const actions = new Da5V5ValidationUiActionBoundary(controller);
    const staleResetOffer = controller.getState().uiRevision;

    const scan = actions.captureRole('A', staleResetOffer);
    const reset = actions.reset(staleResetOffer);

    expect(controller.getState()).toMatchObject({
      phase: 'failed',
      failureReason: 'operation_order_rejected',
    });
    expect(port.stop).not.toHaveBeenCalled();
    expect(port.cancelCapture).toHaveBeenCalledTimes(1);

    release({ status: 'cancelled' });
    await Promise.all([scan, reset]);
    expect(controller.getState().phase).toBe('failed');
    expect(controller.getState().phase).not.toBe('device_checkpoint');
    expect(port.stop).not.toHaveBeenCalled();
  });

  it.each([
    [
      'technology_evidence',
      'technology_evidence_rejected',
      'Der erlaubte NFC-Technologie-Nachweis konnte nicht sicher bestätigt werden.',
    ],
    [
      'uid_readability',
      'uid_readability_rejected',
      'Die NFC-Kennung konnte nicht sicher gelesen werden.',
    ],
    [
      'listener_registration',
      'listener_registration_failed',
      'Die lokale NFC-Erfassung konnte nicht sicher registriert werden.',
    ],
    [
      'digest',
      'digest_failed',
      'Der lokale Prüffingerprint konnte nicht sicher erzeugt werden.',
    ],
    [
      'concurrency',
      'concurrency_rejected',
      'Eine gleichzeitige NFC-Erfassung wurde sicher abgelehnt.',
    ],
    [
      'cleanup',
      'cleanup_failed',
      'Die lokale Bereinigung konnte nicht sicher bestätigt werden.',
    ],
  ] as const)(
    'maps native %s failure to the fixed Controller/UI allowlist',
    async (failureStage, failureReason, message) => {
      const { controller } = harness([{
        status: 'failed',
        failureStage,
      }]);
      await startReady(controller);
      await controller.captureRole('A');
      expect(controller.getState()).toMatchObject({
        phase: 'failed',
        outcome: 'failed_closed',
        failureReason,
      });
      expect(
        DA5_V5_VALIDATION_FAILURE_REASON_BY_CAPTURE_STAGE[failureStage],
      ).toBe(failureReason);
      expect(DA5_V5_VALIDATION_FAILURE_MESSAGES[failureReason]).toBe(message);
      expect(message).not.toMatch(
        /uid [0-9a-f]|payload|techTypes|provider|exception|stack|logcat/iu,
      );
    },
  );

  it.each(['cancelled', 'timed_out'] as const)(
    'preserves retryable %s behavior without counter mutation',
    async (status) => {
      const { controller } = harness([{ status }]);
      await startReady(controller);
      await controller.captureRole('A');
      expect(controller.getState()).toMatchObject({
        phase: 'ready',
        outcome: status,
        failureReason: null,
        slots: {
          A: { progress: 0 },
          B: { progress: 0 },
          X: { progress: 0 },
        },
      });
    },
  );

  it.each([
    { status: 'failed', failureStage: 'foreign raw uid 04A1B2C3' },
    { status: 'foreign', exception: 'payload secret native detail' },
  ])('fails closed on foreign capture contract state %#', async (foreign) => {
    const { controller } = harness([
      foreign as unknown as Da5V5ValidationCaptureResult,
    ]);
    await startReady(controller);
    await controller.captureRole('A');
    expect(controller.getState()).toMatchObject({
      phase: 'failed',
      outcome: 'failed_closed',
      failureReason: 'scan_evidence_rejected',
    });
    expect(JSON.stringify(controller.getState())).not.toMatch(
      /04A1B2C3|payload secret|native detail/u,
    );
  });

  it('reset and stop clear all safe values and stop capture ownership', async () => {
    const { controller, port } = harness([captured('A')]);
    const listener = vi.fn();
    controller.subscribe(listener);
    await startReady(controller);
    await controller.captureRole('A');
    expect(controller.getState().slots.A.fingerprint).toBe(fingerprints.A);

    await controller.reset();
    expect(controller.getState()).toMatchObject({
      deviceBinding,
      phase: 'device_checkpoint',
      slots: {
        A: { fingerprint: null, technology: null, progress: 0 },
        B: { fingerprint: null, technology: null, progress: 0 },
        X: { fingerprint: null, technology: null, progress: 0 },
      },
    });

    await controller.stop();
    const callsAfterStop = listener.mock.calls.length;
    expect(controller.getState()).toMatchObject({
      phase: 'stopped',
      slots: {
        A: { fingerprint: null, technology: null, progress: 0 },
        B: { fingerprint: null, technology: null, progress: 0 },
        X: { fingerprint: null, technology: null, progress: 0 },
      },
    });
    const unsubscribe = controller.subscribe(listener);
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(callsAfterStop);
    expect(port.stop).toHaveBeenCalledTimes(2);
  });

  it.each(['reset', 'stop'] as const)(
    '%s clears every safe value and reports fail-closed cleanup failure',
    async (operation) => {
      const { controller, port } = harness([captured('A')]);
      vi.mocked(port.stop).mockRejectedValue(
        new Error('synthetic cleanup failure'),
      );
      await startReady(controller);
      await controller.captureRole('A');
      expect(controller.getState().slots.A.fingerprint).toBe(fingerprints.A);

      await controller[operation]();

      expect(controller.getState()).toMatchObject({
        capability: 'unavailable',
        phase: 'failed',
        outcome: 'failed_closed',
        failureReason: 'cleanup_failed',
        slots: {
          A: { fingerprint: null, technology: null, progress: 0 },
          B: { fingerprint: null, technology: null, progress: 0 },
          X: { fingerprint: null, technology: null, progress: 0 },
        },
      });
    },
  );

  it('maps failures to a fixed disclosure-safe allowlist without raw diagnostics', async () => {
    const { controller, port } = harness();
    vi.mocked(port.capture).mockRejectedValue(
      new Error(
        'raw uid 04A1B2C3 payload secret provider-id internal-identifier',
      ),
    );
    await startReady(controller);
    await controller.captureRole('A');

    const state = controller.getState();
    expect(DA5_V5_VALIDATION_FAILURE_REASONS).toContain(
      state.failureReason,
    );
    expect(state.failureReason).toBe('listener_registration_failed');
    expect(
      DA5_V5_VALIDATION_FAILURE_MESSAGES[state.failureReason!],
    ).toBe(
      'Die lokale NFC-Erfassung konnte nicht sicher registriert werden.',
    );
    expect(JSON.stringify(state)).not.toMatch(
      /04A1B2C3|payload secret|provider-id|internal-identifier/u,
    );
  });

  it('fails closed before A/B/X when the exact device binding is malformed', async () => {
    const { controller, capture } = harness([], {
      ...deviceBinding,
      talkBackEnabled: false,
    });
    await controller.start();
    expect(controller.getState()).toMatchObject({
      deviceBinding: null,
      phase: 'failed',
      outcome: 'failed_closed',
    });
    controller.confirmDeviceBinding();
    await controller.captureRole('A');
    expect(capture).not.toHaveBeenCalled();
  });

  it('requires the explicit device checkpoint before native capture', async () => {
    const { controller, capture } = harness();
    await controller.start();
    expect(controller.getState().phase).toBe('device_checkpoint');
    await controller.captureRole('A');
    expect(controller.getState().phase).toBe('failed');
    expect(capture).not.toHaveBeenCalled();
  });
});
