import {
  DA5_V5_VALIDATION_TECHNOLOGY,
  type Da5V5ValidationCapability,
  type Da5V5ValidationCapturePort,
  type Da5V5ValidationCaptureResult,
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

export interface Da5V5ValidationSlotState {
  readonly fingerprint: string | null;
  readonly technology: Da5V5ValidationTechnology | null;
  readonly progress: number;
}

export interface Da5V5ValidationState {
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
    | 'unreadable'
    | 'unavailable'
    | 'failed_closed'
    | null;
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
      });
    } catch {
      if (generation === this.generation) {
        this.update({
          ...this.state,
          capability: 'unavailable',
          phase: 'failed',
          outcome: 'failed_closed',
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
      this.failClosed();
      return;
    }
    this.update({
      ...this.state,
      phase: 'ready',
      outcome: null,
    });
  }

  captureRole(role: Da5V5ValidationRole): Promise<void> {
    if (this.captureFlight !== null) {
      const previous = this.captureFlight;
      this.generation += 1;
      this.failClosed();
      return this.capture.cancelCapture()
        .then(() => previous.catch(() => undefined));
    }
    if (
      this.state.phase !== 'ready'
      || this.state.capability !== 'ready'
      || role !== this.state.activeRole
    ) {
      this.generation += 1;
      this.failClosed();
      return Promise.resolve();
    }

    const generation = this.generation;
    this.update({ ...this.state, phase: 'capturing', outcome: null });
    const operation = this.captureOne(role, generation);
    const flight = operation.finally(() => {
      if (this.captureFlight === flight) {
        this.captureFlight = null;
      }
    });
    this.captureFlight = flight;
    return flight;
  }

  async cancel(): Promise<void> {
    try {
      await this.capture.cancelCapture();
    } catch {
      this.generation += 1;
      this.failClosed();
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
    });
    this.listeners.clear();
  }

  private async captureOne(
    role: Da5V5ValidationRole,
    generation: number,
  ): Promise<void> {
    let result: Da5V5ValidationCaptureResult;
    try {
      result = await this.capture.capture();
    } catch {
      result = { status: 'unavailable' };
    }
    if (generation !== this.generation) {
      return;
    }
    if (
      result.status === 'technology_rejected'
      || result.status === 'concurrent_rejected'
      || result.status === 'unavailable'
      || result.status === 'unreadable'
    ) {
      this.generation += 1;
      this.failClosed();
      return;
    }
    if (result.status !== 'captured') {
      this.update({
        ...this.state,
        phase: 'ready',
        outcome: result.status,
      });
      return;
    }
    if (
      !SAFE_FINGERPRINT_PATTERN.test(result.fingerprint)
      || result.technology !== DA5_V5_VALIDATION_TECHNOLOGY
    ) {
      this.generation += 1;
      this.failClosed();
      return;
    }

    const current = this.state.slots[role];
    if (
      current.fingerprint !== null
      && current.fingerprint !== result.fingerprint
    ) {
      this.generation += 1;
      this.failClosed();
      return;
    }
    if (DA5_V5_VALIDATION_ROLES.some(
      (candidate) => candidate !== role
        && this.state.slots[candidate].fingerprint === result.fingerprint,
    )) {
      this.generation += 1;
      this.failClosed();
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
    });
  }

  private failClosed(): void {
    this.update({
      ...this.state,
      phase: 'failed',
      outcome: 'failed_closed',
    });
  }

  private update(state: Da5V5ValidationState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}

function initialState(): Da5V5ValidationState {
  return {
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
  };
}

function emptySlot(): Da5V5ValidationSlotState {
  return {
    fingerprint: null,
    technology: null,
    progress: 0,
  };
}
