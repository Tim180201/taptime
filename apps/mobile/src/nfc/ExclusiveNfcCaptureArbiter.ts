import type { NfcScanCaptureResult, NfcScanPort } from '@taptime/core';
import type { NfcCapabilityState, NfcCaptureLifecyclePort } from './RnNfcScanAdapter';

export type NfcCaptureOwner = 'lifecycle' | 'administration';
export type ScopedNfcCapturePort = NfcScanPort & NfcCaptureLifecyclePort;
export interface NativeNfcIngressCapturePort {
  consume(): NfcScanCaptureResult | null;
}

/** Ensures one native capture can belong to exactly one product flow. */
export class ExclusiveNfcCaptureArbiter {
  private activeOwner: NfcCaptureOwner | null = null;

  constructor(
    private readonly native: ScopedNfcCapturePort,
    private readonly ingress: NativeNfcIngressCapturePort | null = null,
  ) {}

  scope(owner: NfcCaptureOwner): ScopedNfcCapturePort {
    return Object.freeze({
      checkCapability: () => this.native.checkCapability(),
      scan: () => this.scan(owner),
      cancelCapture: () => this.cancel(owner),
      stop: () => this.cancel(owner),
    });
  }

  async stop(): Promise<void> {
    this.activeOwner = null;
    await this.native.stop();
  }

  private async scan(owner: NfcCaptureOwner): Promise<NfcScanCaptureResult> {
    if (this.activeOwner !== null) {
      return { status: 'unavailable' };
    }
    this.activeOwner = owner;
    try {
      const ingressCapture = owner === 'lifecycle'
        ? this.ingress?.consume() ?? null
        : null;
      if (ingressCapture !== null) return ingressCapture;
      return await this.native.scan();
    } finally {
      if (this.activeOwner === owner) {
        this.activeOwner = null;
      }
    }
  }

  private async cancel(owner: NfcCaptureOwner): Promise<void> {
    if (this.activeOwner !== owner) {
      return;
    }
    await this.native.cancelCapture();
  }
}
