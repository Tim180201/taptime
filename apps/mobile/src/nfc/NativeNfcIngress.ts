import {
  createCanonicalNfcUidPayload,
  createTimestamp,
  type NfcScanCaptureResult,
} from '@taptime/core';
import NativeIngress from '../../modules/taptime-nfc-ingress';

export interface NativeNfcIngressSource {
  hasPending(): boolean;
  consume(): {
    readonly uid: readonly number[];
    readonly wallClockMilliseconds: number;
    readonly elapsedRealtimeMilliseconds: number;
  } | null;
  clear(): void;
}

export class NativeNfcIngressCapturePort {
  constructor(private readonly source: NativeNfcIngressSource = NativeIngress) {}

  hasPending(): boolean {
    return this.source.hasPending();
  }

  consume(): NfcScanCaptureResult | null {
    const capture = this.source.consume();
    if (capture === null) return null;
    try {
      const uid = capture.uid
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      return {
        status: 'captured',
        payload: createCanonicalNfcUidPayload(uid),
        capturedAt: createTimestamp(new Date(capture.wallClockMilliseconds).toISOString()),
      };
    } catch {
      return { status: 'unreadable' };
    }
  }

  clear(): void {
    this.source.clear();
  }
}

export interface NativeNfcIngressScanCapability {
  scan(): Promise<void>;
}

export interface NativeNfcIngressAuthorityReader {
  captureNativeNfcIngressAuthority(): Promise<object | null>;
  isNativeNfcIngressAuthorityCurrent(snapshot: object): boolean;
}

/**
 * Bridges Android Tag Dispatch into the same product scan coordinator as foreground capture.
 * Polling is process-local only: no service, wake lock, background capture, or persisted raw UID.
 */
export class NativeNfcIngressLifecycle {
  private interval: ReturnType<typeof setInterval> | null = null;
  private checking = false;

  constructor(
    private readonly ingress: Pick<NativeNfcIngressCapturePort, 'hasPending' | 'clear'>,
    private readonly scan: NativeNfcIngressScanCapability,
    private readonly authority: NativeNfcIngressAuthorityReader,
    private readonly schedule: typeof setInterval = setInterval,
    private readonly unschedule: typeof clearInterval = clearInterval,
  ) {}

  start(): void {
    if (this.interval !== null) return;
    void this.tick();
    this.interval = this.schedule(() => void this.tick(), 250);
  }

  stop(): void {
    if (this.interval !== null) this.unschedule(this.interval);
    this.interval = null;
    this.checking = false;
    this.ingress.clear();
  }

  private async tick(): Promise<void> {
    if (this.checking || !this.ingress.hasPending()) return;
    this.checking = true;
    try {
      const authority = await this.authority.captureNativeNfcIngressAuthority();
      if (
        authority === null
        || !this.authority.isNativeNfcIngressAuthorityCurrent(authority)
      ) {
        this.ingress.clear();
        return;
      }
      await this.scan.scan();
      if (this.ingress.hasPending()) this.ingress.clear();
    } finally {
      this.checking = false;
    }
  }
}
