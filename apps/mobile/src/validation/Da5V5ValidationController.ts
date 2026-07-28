import {
  DA5_V5_VALIDATION_CAPTURE_FAILURE_STAGES,
  DA5_V5_VALIDATION_TECHNOLOGY,
  type Da5V5ValidationCapability,
  type Da5V5ValidationCaptureFailureStage,
  type Da5V5ValidationCapturePort,
  type Da5V5ValidationTechnology,
} from './Da5V5ValidationContract';
import {
  requireDa5V5ValidationDeviceBinding,
  type Da5V5ValidationDeviceBinding,
  type Da5V5ValidationDeviceBindingPort,
} from './Da5V5ValidationDeviceBinding';

export const DA5_V5_VALIDATION_ROLES = ['A', 'B', 'X'] as const;
export type Da5V5ValidationRole =
  typeof DA5_V5_VALIDATION_ROLES[number];
export const DA5_V5_VALIDATION_STABLE_READS = 10;
export const DA5_V5_VALIDATION_FAILURE_REASONS = [
  'device_or_nfc_binding_rejected',
  'operation_order_rejected',
  'scan_evidence_rejected',
  'technology_evidence_rejected',
  'uid_readability_rejected',
  'listener_registration_failed',
  'digest_failed',
  'concurrency_rejected',
  'cleanup_failed',
] as const;
export type Da5V5ValidationFailureReason =
  typeof DA5_V5_VALIDATION_FAILURE_REASONS[number];

export const DA5_V5_VALIDATION_FAILURE_MESSAGES: Readonly<
  Record<Da5V5ValidationFailureReason, string>
> = Object.freeze({
  device_or_nfc_binding_rejected:
    'Geräte- oder NFC-Bindung konnte nicht sicher bestätigt werden.',
  operation_order_rejected:
    'Die erwartete lokale Reihenfolge konnte nicht sicher bestätigt werden.',
  scan_evidence_rejected:
    'Der Scan konnte nicht als gültiger lokaler Nachweis bestätigt werden.',
  technology_evidence_rejected:
    'Der erlaubte NFC-Technologie-Nachweis konnte nicht sicher bestätigt werden.',
  uid_readability_rejected:
    'Die NFC-Kennung konnte nicht sicher gelesen werden.',
  listener_registration_failed:
    'Die lokale NFC-Erfassung konnte nicht sicher registriert werden.',
  digest_failed:
    'Der lokale Prüffingerprint konnte nicht sicher erzeugt werden.',
  concurrency_rejected:
    'Eine gleichzeitige NFC-Erfassung wurde sicher abgelehnt.',
  cleanup_failed:
    'Die lokale Bereinigung konnte nicht sicher bestätigt werden.',
});

export const DA5_V5_VALIDATION_FAILURE_REASON_BY_CAPTURE_STAGE: Readonly<
  Record<Da5V5ValidationCaptureFailureStage, Da5V5ValidationFailureReason>
> = Object.freeze({
  technology_evidence: 'technology_evidence_rejected',
  uid_readability: 'uid_readability_rejected',
  listener_registration: 'listener_registration_failed',
  digest: 'digest_failed',
  concurrency: 'concurrency_rejected',
  cleanup: 'cleanup_failed',
});

export interface Da5V5ValidationSlotState {
  readonly fingerprint: string | null;
  readonly technology: Da5V5ValidationTechnology | null;
  readonly progress: number;
}

export interface Da5V5ValidationState {
  readonly uiRevision: number;
  readonly capability: 'checking' | Da5V5ValidationCapability | 'unavailable';
  readonly phase:
    | 'checking'
    | 'device_checkpoint'
    | 'ready'
    | 'capturing'
    | 'failed'
    | 'complete'
    | 'stopped';
  readonly deviceBinding: Da5V5ValidationDeviceBinding | null;
  readonly activeRole: Da5V5ValidationRole;
  readonly slots: Readonly<Record<
    Da5V5ValidationRole,
    Da5V5ValidationSlotState
  >>;
  readonly outcome:
    | 'captured'
    | 'cancelled'
    | 'timed_out'
    | 'failed_closed'
    | null;
  readonly failureReason: Da5V5ValidationFailureReason | null;
}

const SAFE_FINGERPRINT_PATTERN = /^[0-9A-F]{12}$/u;

export class Da5V5ValidationController {
  private state = initialState();
  private readonly listeners = new Set<() => void>();
  private captureFlight: Promise<void> | null = null;
  private generation = 0;

  constructor(
    private readonly capture: Da5V5ValidationCapturePort,
    private readonly deviceBinding: Da5V5ValidationDeviceBindingPort,
  ) {}

  getState = (): Da5V5ValidationState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    if (this.state.phase === 'stopped') {
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async start(): Promise<void> {
    const generation = this.generation;
    try {
      const binding = requireDa5V5ValidationDeviceBinding(
        await this.deviceBinding.readBinding(),
      );
      const capability = await this.capture.checkCapability();
      if (generation !== this.generation) {
        return;
      }
      this.update({
        ...this.state,
        capability,
        deviceBinding: binding,
        phase: capability === 'ready' ? 'device_checkpoint' : 'failed',
        outcome: capability === 'ready' ? null : 'failed_closed',
        failureReason: capability === 'ready'
          ? null
          : 'device_or_nfc_binding_rejected',
      });
    } catch {
      if (generation === this.generation) {
        this.update({
          ...this.state,
          capability: 'unavailable',
          phase: 'failed',
          outcome: 'failed_closed',
          failureReason: 'device_or_nfc_binding_rejected',
        });
      }
    }
  }

  confirmDeviceBinding(): void {
    if (
      this.state.phase !== 'device_checkpoint'
      || this.state.capability !== 'ready'
      || this.state.deviceBinding === null
    ) {
      this.generation += 1;
      this.failClosed('operation_order_rejected');
      return;
    }
    this.update({
      ...this.state,
      phase: 'ready',
      outcome: null,
      failureReason: null,
    });
  }

  captureRole(role: Da5V5ValidationRole): Promise<void> {
    if (this.captureFlight !== null) {
      return this.rejectOperationOrder();
    }
    if (
      this.state.phase !== 'ready'
      || this.state.capability !== 'ready'
      || role !== this.state.activeRole
    ) {
      this.generation += 1;
      this.failClosed('operation_order_rejected');
      return Promise.resolve();
    }

    const generation = this.generation;
    this.update({
      ...this.state,
      phase: 'capturing',
      outcome: null,
      failureReason: null,
    });
    const operation = this.captureOne(role, generation);
    const flight = operation.finally(() => {
      if (this.captureFlight === flight) {
        this.captureFlight = null;
      }
    });
    this.captureFlight = flight;
    return flight;
  }

  /**
   * Strict rejection hook for stale UI offers. It deliberately shares the
   * Controller's existing concurrent-operation cancellation semantics.
   */
  rejectOperationOrder(): Promise<void> {
    const previous = this.captureFlight;
    this.generation += 1;
    this.failClosed('operation_order_rejected');
    if (previous === null) {
      return Promise.resolve();
    }
    return this.capture.cancelCapture()
      .then(() => previous.catch(() => undefined));
  }

  async cancel(): Promise<void> {
    try {
      await this.capture.cancelCapture();
    } catch {
      this.generation += 1;
      this.failClosed('cleanup_failed');
    }
  }

  async reset(): Promise<void> {
    this.generation += 1;
    let cleanupFailed = false;
    try {
      await this.capture.stop();
    } catch {
      cleanupFailed = true;
    }
    const capability = this.state.capability;
    const deviceBinding = this.state.deviceBinding;
    this.update({
      ...initialState(),
      capability: cleanupFailed ? 'unavailable' : capability,
      deviceBinding: cleanupFailed ? null : deviceBinding,
      phase: cleanupFailed
        ? 'failed'
        : capability === 'ready'
          ? 'device_checkpoint'
          : 'checking',
      outcome: cleanupFailed ? 'failed_closed' : null,
      failureReason: cleanupFailed ? 'cleanup_failed' : null,
    });
  }

  async stop(): Promise<void> {
    this.generation += 1;
    let cleanupFailed = false;
    try {
      await this.capture.stop();
    } catch {
      cleanupFailed = true;
    }
    this.update({
      ...initialState(),
      capability: cleanupFailed ? 'unavailable' : 'checking',
      phase: cleanupFailed ? 'failed' : 'stopped',
      outcome: cleanupFailed ? 'failed_closed' : null,
      failureReason: cleanupFailed ? 'cleanup_failed' : null,
    });
    this.listeners.clear();
  }

  private async captureOne(
    role: Da5V5ValidationRole,
    generation: number,
  ): Promise<void> {
    let result: unknown;
    try {
      result = await this.capture.capture();
    } catch {
      result = {
        status: 'failed',
        failureStage: 'listener_registration',
      };
    }
    if (generation !== this.generation) {
      return;
    }
    if (isCaptureFailure(result)) {
      this.generation += 1;
      this.failClosed(
        DA5_V5_VALIDATION_FAILURE_REASON_BY_CAPTURE_STAGE[
          result.failureStage
        ],
      );
      return;
    }
    if (isRetryableCaptureResult(result)) {
      this.update({
        ...this.state,
        phase: 'ready',
        outcome: result.status,
        failureReason: null,
      });
      return;
    }
    if (!isCapturedResult(result)) {
      this.generation += 1;
      this.failClosed('scan_evidence_rejected');
      return;
    }
    if (
      !SAFE_FINGERPRINT_PATTERN.test(result.fingerprint)
      || result.technology !== DA5_V5_VALIDATION_TECHNOLOGY
    ) {
      this.generation += 1;
      this.failClosed('scan_evidence_rejected');
      return;
    }

    const current = this.state.slots[role];
    if (
      current.fingerprint !== null
      && current.fingerprint !== result.fingerprint
    ) {
      this.generation += 1;
      this.failClosed('scan_evidence_rejected');
      return;
    }
    if (DA5_V5_VALIDATION_ROLES.some(
      (candidate) => candidate !== role
        && this.state.slots[candidate].fingerprint === result.fingerprint,
    )) {
      this.generation += 1;
      this.failClosed('scan_evidence_rejected');
      return;
    }

    const progress = current.progress + 1;
    const slots = {
      ...this.state.slots,
      [role]: Object.freeze({
        fingerprint: result.fingerprint,
        technology: result.technology,
        progress,
      }),
    };
    const roleIndex = DA5_V5_VALIDATION_ROLES.indexOf(role);
    const roleComplete = progress === DA5_V5_VALIDATION_STABLE_READS;
    const allComplete = roleComplete
      && roleIndex === DA5_V5_VALIDATION_ROLES.length - 1;
    this.update({
      ...this.state,
      activeRole: roleComplete && !allComplete
        ? DA5_V5_VALIDATION_ROLES[roleIndex + 1]!
        : role,
      slots,
      phase: allComplete ? 'complete' : 'ready',
      outcome: 'captured',
      failureReason: null,
    });
  }

  private failClosed(reason: Da5V5ValidationFailureReason): void {
    this.update({
      ...this.state,
      phase: 'failed',
      outcome: 'failed_closed',
      failureReason: reason,
    });
  }

  private update(state: Da5V5ValidationState): void {
    this.state = {
      ...state,
      uiRevision: this.state.uiRevision + 1,
    };
    this.listeners.forEach((listener) => listener());
  }
}

function initialState(): Da5V5ValidationState {
  return {
    uiRevision: 0,
    capability: 'checking',
    deviceBinding: null,
    phase: 'checking',
    activeRole: 'A',
    slots: {
      A: emptySlot(),
      B: emptySlot(),
      X: emptySlot(),
    },
    outcome: null,
    failureReason: null,
  };
}

function emptySlot(): Da5V5ValidationSlotState {
  return {
    fingerprint: null,
    technology: null,
    progress: 0,
  };
}

function isCaptureFailure(
  value: unknown,
): value is Readonly<{
  status: 'failed';
  failureStage: Da5V5ValidationCaptureFailureStage;
}> {
  if (!isRecord(value) || value.status !== 'failed') {
    return false;
  }
  return DA5_V5_VALIDATION_CAPTURE_FAILURE_STAGES.some(
    (stage) => value.failureStage === stage,
  );
}

function isRetryableCaptureResult(
  value: unknown,
): value is Readonly<{ status: 'cancelled' | 'timed_out' }> {
  return isRecord(value)
    && (value.status === 'cancelled' || value.status === 'timed_out');
}

function isCapturedResult(
  value: unknown,
): value is Readonly<{
  status: 'captured';
  fingerprint: string;
  technology: string;
}> {
  return isRecord(value)
    && value.status === 'captured'
    && typeof value.fingerprint === 'string'
    && typeof value.technology === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value);
}

/**
 * UI-only activation boundary. It coalesces only repeated activations of the
 * exact same visible action; the Controller remains the strict owner of
 * ordering, concurrency and fail-closed behavior.
 */
export class Da5V5ValidationUiActionBoundary {
  private deviceConfirmationConsumed = false;
  private activeScanPromise: Promise<void> | null = null;
  private readonly consumedScanOffers = new Map<number, Readonly<{
    role: Da5V5ValidationRole;
    promise: Promise<void>;
  }>>();

  constructor(
    private readonly controller: Da5V5ValidationController,
  ) {}

  confirmDeviceBinding(): void {
    if (this.deviceConfirmationConsumed) {
      return;
    }
    this.deviceConfirmationConsumed = true;
    this.controller.confirmDeviceBinding();
  }

  captureRole(
    role: Da5V5ValidationRole,
    uiOfferRevision: number,
  ): Promise<void> {
    const consumed = this.consumedScanOffers.get(uiOfferRevision);
    if (consumed !== undefined) {
      return consumed.role === role
        ? consumed.promise
        : this.controller.rejectOperationOrder();
    }

    const state = this.controller.getState();
    if (
      state.phase !== 'ready'
      || state.capability !== 'ready'
      || state.activeRole !== role
      || state.uiRevision !== uiOfferRevision
    ) {
      return this.controller.rejectOperationOrder();
    }

    const operation = this.controller.captureRole(role);
    const promise = operation.finally(() => {
      if (this.activeScanPromise === promise) {
        this.activeScanPromise = null;
      }
    });
    this.activeScanPromise = promise;
    this.consumedScanOffers.set(
      uiOfferRevision,
      Object.freeze({ role, promise }),
    );
    return promise;
  }

  cancel(): Promise<void> {
    return this.controller.cancel();
  }

  reset(uiOfferRevision: number): Promise<void> {
    const state = this.controller.getState();
    if (
      this.activeScanPromise !== null
      || state.phase === 'capturing'
      || state.uiRevision !== uiOfferRevision
    ) {
      return this.controller.rejectOperationOrder();
    }
    return this.controller.reset().finally(() => {
      this.deviceConfirmationConsumed = false;
      this.activeScanPromise = null;
      this.consumedScanOffers.clear();
    });
  }
}
