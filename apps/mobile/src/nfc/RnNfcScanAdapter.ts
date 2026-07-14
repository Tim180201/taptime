import { Platform } from 'react-native';
import NfcManager, { NfcEvents, type TagEvent } from 'react-native-nfc-manager';
import {
  createCanonicalNfcUidPayload,
  createTimestamp,
  type NfcScanCaptureResult,
  type NfcScanPort,
  type Timestamp,
} from '@taptime/core';

export type NfcCapabilityState = 'ready' | 'not_supported' | 'disabled';

export interface NfcCaptureLifecyclePort {
  checkCapability(): Promise<NfcCapabilityState>;
  cancelCapture(): Promise<void>;
  stop(): Promise<void>;
}

export interface RnNfcScanAdapterOptions {
  readonly platform?: string;
  readonly timeoutMilliseconds?: number;
  readonly scheduleTimeout?: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>;
  readonly clearScheduledTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
  readonly captureTimestamp?: () => Timestamp;
}

interface ActiveCapture {
  readonly finish: (result: NfcScanCaptureResult) => Promise<void>;
}

const DEFAULT_CAPTURE_TIMEOUT_MILLISECONDS = 20_000;

export function normalizeTag(tag: TagEvent, capturedAt: Timestamp): NfcScanCaptureResult {
  if (typeof tag.id !== 'string') {
    return { status: 'unreadable' };
  }
  try {
    return {
      status: 'captured',
      payload: createCanonicalNfcUidPayload(tag.id),
      capturedAt,
    };
  } catch {
    // A raw UID is deliberately neither repaired nor logged. ADR-0009 excludes missing,
    // non-canonical, random and otherwise unsuitable identifiers from the v1 product path.
    return { status: 'unreadable' };
  }
}

/**
 * Android hardware implementation of NfcScanPort. It owns native listener lifetime only; the
 * server remains the assignment and lifecycle authority. Product code has exactly one capture
 * entry point: scan().
 */
export class RnNfcScanAdapter implements NfcScanPort, NfcCaptureLifecyclePort {
  private readonly platform: string;
  private readonly timeoutMilliseconds: number;
  private readonly scheduleTimeout: NonNullable<RnNfcScanAdapterOptions['scheduleTimeout']>;
  private readonly clearScheduledTimeout: NonNullable<RnNfcScanAdapterOptions['clearScheduledTimeout']>;
  private readonly captureTimestamp: NonNullable<RnNfcScanAdapterOptions['captureTimestamp']>;
  private started = false;
  private startFlight: Promise<void> | null = null;
  private captureFlight: Promise<NfcScanCaptureResult> | null = null;
  private registrationDrain: Promise<void> | null = null;
  private activeCapture: ActiveCapture | null = null;
  private cancellationVersion = 0;

  constructor(options: RnNfcScanAdapterOptions = {}) {
    this.platform = options.platform ?? Platform.OS;
    this.timeoutMilliseconds = options.timeoutMilliseconds
      ?? DEFAULT_CAPTURE_TIMEOUT_MILLISECONDS;
    this.scheduleTimeout = options.scheduleTimeout ?? setTimeout;
    this.clearScheduledTimeout = options.clearScheduledTimeout ?? clearTimeout;
    this.captureTimestamp = options.captureTimestamp
      ?? (() => createTimestamp(new Date().toISOString()));
  }

  async checkCapability(): Promise<NfcCapabilityState> {
    if (this.platform !== 'android') {
      return 'not_supported';
    }
    const supported = await NfcManager.isSupported();
    if (!supported) {
      return 'not_supported';
    }

    await this.ensureStarted();
    const enabled = await NfcManager.isEnabled();
    return enabled ? 'ready' : 'disabled';
  }

  scan(): Promise<NfcScanCaptureResult> {
    if (this.captureFlight !== null) {
      return this.captureFlight;
    }
    if (this.registrationDrain !== null) {
      return Promise.resolve({ status: 'unavailable' });
    }
    const cancellationVersion = this.cancellationVersion;
    const operation = this.performScan(cancellationVersion);
    const flight = operation.finally(() => {
      if (this.captureFlight === flight) {
        this.captureFlight = null;
      }
    });
    this.captureFlight = flight;
    return flight;
  }

  async cancelCapture(): Promise<void> {
    if (this.captureFlight !== null) {
      this.cancellationVersion += 1;
    }
    await this.activeCapture?.finish({ status: 'cancelled' });
  }

  async stop(): Promise<void> {
    await this.cancelCapture();
  }

  private async performScan(cancellationVersion: number): Promise<NfcScanCaptureResult> {
    if (this.platform !== 'android') {
      return { status: 'unavailable' };
    }
    try {
      await this.ensureStarted();
    } catch {
      return { status: 'unavailable' };
    }
    if (cancellationVersion !== this.cancellationVersion) {
      return { status: 'cancelled' };
    }

    return new Promise<NfcScanCaptureResult>((resolve) => {
      let settled = false;
      let cleanupFlight: Promise<void> | null = null;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let registrationSettled = false;
      let releaseRegistrationSettlement!: () => void;
      const registrationSettlement = new Promise<void>((release) => {
        releaseRegistrationSettlement = release;
      });

      const capture: ActiveCapture = {
        finish: (result) => {
          if (cleanupFlight !== null) {
            return cleanupFlight;
          }
          if (settled) {
            return Promise.resolve();
          }
          settled = true;
          if (timeoutHandle !== null) {
            this.clearScheduledTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          try {
            NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
          } catch {
            // Native listener removal is followed by best-effort unregistration below.
          }
          // If the native registration call itself is still pending, settle the caller but hold
          // later scans until that attempt settles and can be unregistered exactly once. This
          // avoids both a hanging UI promise and a late cleanup unregistering a newer capture.
          const nativeCleanup = registrationSettled
            ? this.unregisterNativeCapture()
            : (this.holdRegistrationDrain(registrationSettlement), Promise.resolve());
          cleanupFlight = nativeCleanup
            .then(() => {
              if (this.activeCapture === capture) {
                this.activeCapture = null;
              }
              resolve(result);
            });
          return cleanupFlight;
        },
      };
      this.activeCapture = capture;

      try {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
          let result: NfcScanCaptureResult;
          try {
            result = normalizeTag(tag, this.captureTimestamp());
          } catch {
            result = { status: 'unavailable' };
          }
          void capture.finish(result);
        });
      } catch {
        registrationSettled = true;
        releaseRegistrationSettlement();
        this.activeCapture = null;
        resolve({ status: 'unavailable' });
        return;
      }
      timeoutHandle = this.scheduleTimeout(() => {
        void capture.finish({ status: 'timed_out' });
      }, this.timeoutMilliseconds);

      let registration: Promise<void>;
      try {
        registration = Promise.resolve(NfcManager.registerTagEvent());
      } catch {
        registrationSettled = true;
        releaseRegistrationSettlement();
        void capture.finish({ status: 'unavailable' });
        return;
      }
      registration
        .then(
          () => {
            registrationSettled = true;
            releaseRegistrationSettlement();
          },
          () => {
            registrationSettled = true;
            releaseRegistrationSettlement();
            void capture.finish({ status: 'unavailable' });
          },
        )
        .catch(() => {
          // The handlers above are deliberately total; this is a final defensive guard.
          registrationSettled = true;
          releaseRegistrationSettlement();
          void capture.finish({ status: 'unavailable' });
        });
    });
  }

  private ensureStarted(): Promise<void> {
    if (this.started) {
      return Promise.resolve();
    }
    if (this.startFlight !== null) {
      return this.startFlight;
    }
    const operation = Promise.resolve(NfcManager.start()).then(() => {
      this.started = true;
    });
    const flight = operation.finally(() => {
      if (this.startFlight === flight) {
        this.startFlight = null;
      }
    });
    this.startFlight = flight;
    return flight;
  }

  private unregisterNativeCapture(): Promise<void> {
    return Promise.resolve()
      .then(() => NfcManager.unregisterTagEvent())
      .catch(() => undefined);
  }

  private holdRegistrationDrain(registrationSettlement: Promise<void>): void {
    if (this.registrationDrain !== null) {
      return;
    }
    const drain = registrationSettlement
      .then(() => this.unregisterNativeCapture());
    this.registrationDrain = drain;
    void drain.finally(() => {
      if (this.registrationDrain === drain) {
        this.registrationDrain = null;
      }
    });
  }
}
