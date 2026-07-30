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
  'capture_cancelled',
  'capture_timed_out',
  'malformed_capture_result_rejected',
  'fingerprint_format_rejected',
  'technology_label_rejected',
  'intra_role_drift_rejected',
  'cross_role_duplicate_rejected',
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
  capture_cancelled:
    'Die laufende NFC-Erfassung wurde abgebrochen.',
  capture_timed_out:
    'Die laufende NFC-Erfassung wurde wegen Zeitüberschreitung gestoppt.',
  malformed_capture_result_rejected:
    'Das lokale Scan-Ergebnis hatte keine erlaubte Form.',
  fingerprint_format_rejected:
    'Der lokale Prüffingerprint hatte keine erlaubte Form.',
  technology_label_rejected:
    'Die lokale NFC-Technologie-Beschriftung war nicht erlaubt.',
  intra_role_drift_rejected:
    'Für dieselbe Rolle wurde ein abweichender Prüffingerprint erkannt.',
  cross_role_duplicate_rejected:
    'Derselbe Prüffingerprint wurde für verschiedene Rollen erkannt.',
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
  async rejectOperationOrder(): Promise<void> {
    const previous = this.captureFlight;
    this.generation += 1;
    this.failClosed('operation_order_rejected');
    if (previous === null) {
      return;
    }
    let cleanupFailed = false;
    try {
      await this.capture.cancelCapture();
    } catch {
      cleanupFailed = true;
    }
    await previous.catch(() => undefined);
    if (cleanupFailed) {
      this.failClosed('cleanup_failed');
    }
  }

  async cancel(): Promise<void> {
    if (this.state.phase !== 'capturing' || this.captureFlight === null) {
      this.generation += 1;
      this.failClosed('operation_order_rejected');
      return;
    }
    const captureFlight = this.captureFlight;
    this.generation += 1;
    const cancellationGeneration = this.generation;
    let cleanupFailed = false;
    try {
      await this.capture.cancelCapture();
    } catch {
      cleanupFailed = true;
    }
    await captureFlight.catch(() => undefined);
    if (cleanupFailed) {
      this.failClosed('cleanup_failed');
      return;
    }
    if (cancellationGeneration === this.generation) {
      this.failClosed('capture_cancelled');
    }
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
    const normalizedResult = normalizeCaptureResult(result);
    if (generation !== this.generation) {
      return;
    }
    if (normalizedResult === null) {
      this.generation += 1;
      this.failClosed('malformed_capture_result_rejected');
      return;
    }
    if (normalizedResult.status === 'failed') {
      this.generation += 1;
      this.failClosed(
        DA5_V5_VALIDATION_FAILURE_REASON_BY_CAPTURE_STAGE[
          normalizedResult.failureStage
        ],
      );
      return;
    }
    if (normalizedResult.status !== 'captured') {
      this.generation += 1;
      this.failClosed(
        normalizedResult.status === 'cancelled'
          ? 'capture_cancelled'
          : 'capture_timed_out',
      );
      return;
    }
    if (!SAFE_FINGERPRINT_PATTERN.test(normalizedResult.fingerprint)) {
      this.generation += 1;
      this.failClosed('fingerprint_format_rejected');
      return;
    }
    if (normalizedResult.technology !== DA5_V5_VALIDATION_TECHNOLOGY) {
      this.generation += 1;
      this.failClosed('technology_label_rejected');
      return;
    }

    const current = this.state.slots[role];
    if (
      current.fingerprint !== null
      && current.fingerprint !== normalizedResult.fingerprint
    ) {
      this.generation += 1;
      this.failClosed('intra_role_drift_rejected');
      return;
    }
    if (DA5_V5_VALIDATION_ROLES.some(
      (candidate) => candidate !== role
        && this.state.slots[candidate].fingerprint
          === normalizedResult.fingerprint,
    )) {
      this.generation += 1;
      this.failClosed('cross_role_duplicate_rejected');
      return;
    }

    const progress = current.progress + 1;
    const slots = {
      ...this.state.slots,
      [role]: Object.freeze({
        fingerprint: normalizedResult.fingerprint,
        technology: normalizedResult.technology,
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
    const effectiveReason = this.state.failureReason === 'cleanup_failed'
      ? 'cleanup_failed'
      : reason;
    this.update({
      ...this.state,
      phase: 'failed',
      outcome: 'failed_closed',
      failureReason: effectiveReason,
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

type NormalizedCaptureResult =
  | Readonly<{
    status: 'failed';
    failureStage: Da5V5ValidationCaptureFailureStage;
  }>
  | Readonly<{ status: 'cancelled' | 'timed_out' }>
  | Readonly<{
    status: 'captured';
    fingerprint: string;
    technology: string;
  }>;

function normalizeCaptureResult(
  value: unknown,
): NormalizedCaptureResult | null {
  try {
    if (
      typeof value !== 'object'
      || value === null
      || Array.isArray(value)
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some((key) => typeof key !== 'string')) {
      return null;
    }
    const stringKeys = keys as string[];
    stringKeys.sort();
    const readDataProperty = (key: string): unknown => {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined
        || descriptor.enumerable !== true
        || !Object.hasOwn(descriptor, 'value')
      ) {
        throw new TypeError('capture result property is not plain data');
      }
      return descriptor.value;
    };
    const exactKeys = (expected: readonly string[]): boolean =>
      stringKeys.join('\n') === [...expected].sort().join('\n');

    if (exactKeys(['failureStage', 'status'])) {
      const status = readDataProperty('status');
      const failureStage = readDataProperty('failureStage');
      const normalizedFailureStage =
        DA5_V5_VALIDATION_CAPTURE_FAILURE_STAGES.find(
          (stage) => stage === failureStage,
        );
      if (status !== 'failed' || normalizedFailureStage === undefined) {
        return null;
      }
      return Object.freeze({
        status,
        failureStage: normalizedFailureStage,
      });
    }
    if (exactKeys(['status'])) {
      const status = readDataProperty('status');
      if (status !== 'cancelled' && status !== 'timed_out') {
        return null;
      }
      return Object.freeze({ status });
    }
    if (exactKeys(['fingerprint', 'status', 'technology'])) {
      const status = readDataProperty('status');
      const fingerprint = readDataProperty('fingerprint');
      const technology = readDataProperty('technology');
      if (
        status !== 'captured'
        || typeof fingerprint !== 'string'
        || typeof technology !== 'string'
      ) {
        return null;
      }
      return Object.freeze({
        status,
        fingerprint,
        technology,
      });
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * UI-only activation boundary. It coalesces only repeated activations of the
 * exact same visible action; the Controller remains the strict owner of
 * ordering, concurrency and fail-closed behavior.
 */
export class Da5V5ValidationUiActionBoundary {
  private deviceConfirmationConsumed = false;
  private activeCancelOffer: Readonly<{
    revision: number;
    promise: Promise<void>;
  }> | null = null;
  private activeScanOffer: Readonly<{
    revision: number;
    role: Da5V5ValidationRole;
    promise: Promise<void>;
  }> | null = null;

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
    const active = this.activeScanOffer;
    if (active !== null) {
      const state = this.controller.getState();
      return state.phase === 'capturing'
        && active.revision === uiOfferRevision
        && active.role === role
        ? active.promise
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
      if (this.activeScanOffer?.promise === promise) {
        this.activeScanOffer = null;
      }
    });
    this.activeScanOffer = Object.freeze({
      revision: uiOfferRevision,
      role,
      promise,
    });
    return promise;
  }

  cancel(uiOfferRevision: number): Promise<void> {
    const active = this.activeCancelOffer;
    if (active !== null) {
      const state = this.controller.getState();
      return state.phase === 'capturing'
        && state.uiRevision === uiOfferRevision
        && active.revision === uiOfferRevision
        ? active.promise
        : this.controller.rejectOperationOrder();
    }
    const state = this.controller.getState();
    if (
      state.phase !== 'capturing'
      || state.uiRevision !== uiOfferRevision
      || this.activeScanOffer === null
    ) {
      return this.controller.rejectOperationOrder();
    }
    const operation = this.controller.cancel();
    const promise = operation.finally(() => {
      if (this.activeCancelOffer?.promise === promise) {
        this.activeCancelOffer = null;
      }
    });
    this.activeCancelOffer = Object.freeze({
      revision: uiOfferRevision,
      promise,
    });
    return promise;
  }

}
