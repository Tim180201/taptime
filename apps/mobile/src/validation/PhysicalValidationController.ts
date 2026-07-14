import type { NfcScanPort } from '@taptime/core';
import type { NfcCaptureLifecyclePort } from '../nfc/RnNfcScanAdapter';

export type ValidationSlot = 'A' | 'B';
export type ValidationCapability = 'checking' | 'ready' | 'not_supported' | 'disabled' | 'unavailable';

export interface ValidationSlotState {
  readonly count: number;
  readonly fingerprint: string | null;
  readonly mismatches: number;
}

export interface PhysicalValidationState {
  readonly capability: ValidationCapability;
  readonly scanning: boolean;
  readonly activeSlot: ValidationSlot;
  readonly slots: Readonly<Record<ValidationSlot, ValidationSlotState>>;
  readonly outcome: 'captured' | 'mismatch' | 'unreadable' | 'timed_out' | 'cancelled' | 'unavailable' | null;
}

const emptySlot = (): ValidationSlotState => ({ count: 0, fingerprint: null, mismatches: 0 });

export class PhysicalValidationController {
  private state: PhysicalValidationState = {
    capability: 'checking', scanning: false, activeSlot: 'A',
    slots: { A: emptySlot(), B: emptySlot() }, outcome: null,
  };
  private readonly listeners = new Set<() => void>();
  private scanFlight: Promise<void> | null = null;

  constructor(
    private readonly scanner: NfcScanPort,
    private readonly lifecycle: NfcCaptureLifecyclePort,
    private readonly fingerprint: (canonicalPayload: string) => Promise<string>,
  ) {}

  getState = (): PhysicalValidationState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async start(): Promise<void> {
    try {
      const capability = await this.lifecycle.checkCapability();
      this.update({ ...this.state, capability });
    } catch {
      this.update({ ...this.state, capability: 'unavailable' });
    }
  }

  selectSlot(slot: ValidationSlot): void {
    if (!this.state.scanning) this.update({ ...this.state, activeSlot: slot, outcome: null });
  }

  scan(): Promise<void> {
    if (this.scanFlight !== null || this.state.capability !== 'ready') return this.scanFlight ?? Promise.resolve();
    const slot = this.state.activeSlot;
    this.update({ ...this.state, scanning: true, outcome: null });
    const operation = this.capture(slot).finally(() => {
      this.scanFlight = null;
    });
    this.scanFlight = operation;
    return operation;
  }

  async cancel(): Promise<void> { await this.lifecycle.cancelCapture(); }
  async stop(): Promise<void> { await this.lifecycle.stop(); }

  reset(): void {
    if (!this.state.scanning) {
      this.update({ ...this.state, slots: { A: emptySlot(), B: emptySlot() }, outcome: null });
    }
  }

  private async capture(slot: ValidationSlot): Promise<void> {
    const result = await this.scanner.scan();
    if (result.status !== 'captured') {
      this.update({ ...this.state, scanning: false, outcome: result.status });
      return;
    }
    let fingerprint: string;
    try {
      fingerprint = await this.fingerprint(result.payload);
    } catch {
      this.update({ ...this.state, scanning: false, outcome: 'unavailable' });
      return;
    }
    const current = this.state.slots[slot];
    const matches = current.fingerprint === null || current.fingerprint === fingerprint;
    const next = matches
      ? { count: current.count + 1, fingerprint, mismatches: current.mismatches }
      : { ...current, mismatches: current.mismatches + 1 };
    this.update({
      ...this.state,
      scanning: false,
      slots: { ...this.state.slots, [slot]: next },
      outcome: matches ? 'captured' : 'mismatch',
    });
  }

  private update(state: PhysicalValidationState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}
