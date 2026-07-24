import {
  createCanonicalNfcUidPayload,
  createTimestamp,
  type NfcScanCaptureResult,
} from '@taptime/core';
import NativeIngress from '../../modules/taptime-nfc-ingress';

export interface NativeNfcIngressSource {
  hasPending(): boolean;
  readPendingEvidence(): NativeNfcIngressCaptureEvidence | null;
  consume(): {
    readonly uid: readonly number[];
    readonly wallClockMilliseconds: number;
    readonly elapsedRealtimeMilliseconds: number;
  } | null;
  clear(): void;
}

export interface NativeNfcIngressCaptureEvidence {
  readonly bootMarker: string;
  readonly elapsedRealtimeMilliseconds: number;
}

export class NativeNfcIngressCapturePort {
  constructor(private readonly source: NativeNfcIngressSource = NativeIngress) {}

  hasPending(): boolean {
    return this.source.hasPending();
  }

  readPendingEvidence(): NativeNfcIngressCaptureEvidence | null {
    try {
      const evidence = this.source.readPendingEvidence();
      if (
        evidence === null
        || typeof evidence.bootMarker !== 'string'
        || evidence.bootMarker.length < 1
        || !Number.isSafeInteger(evidence.elapsedRealtimeMilliseconds)
        || evidence.elapsedRealtimeMilliseconds < 0
      ) {
        this.source.clear();
        return null;
      }
      return Object.freeze({ ...evidence });
    } catch {
      this.source.clear();
      return null;
    }
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
  captureNativeNfcIngressAuthority(
    evidence: NativeNfcIngressCaptureEvidence,
  ): Promise<object | null>;
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
    private readonly ingress: Pick<
      NativeNfcIngressCapturePort,
      'hasPending' | 'readPendingEvidence' | 'clear'
    >,
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
      const evidence = this.ingress.readPendingEvidence();
      if (evidence === null) {
        this.ingress.clear();
        return;
      }
      const authority = await this.authority.captureNativeNfcIngressAuthority(evidence);
      const currentEvidence = this.ingress.readPendingEvidence();
      if (
        authority === null
        || !this.authority.isNativeNfcIngressAuthorityCurrent(authority)
        || currentEvidence === null
        || currentEvidence.bootMarker !== evidence.bootMarker
        || currentEvidence.elapsedRealtimeMilliseconds
          !== evidence.elapsedRealtimeMilliseconds
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
