import NfcManager, { NfcError, NfcEvents, NfcTech, type TagEvent } from 'react-native-nfc-manager';
import type { NfcScanCaptureResult } from '@taptime/core';

export type CapturedTagAction = (capture: Extract<NfcScanCaptureResult, { status: 'captured' }>) => Promise<void>;

export function isIosTagReaderSupported(): Promise<boolean> {
  // 3.17.2 implements the technology argument in JS/native but omits it from index.d.ts.
  const manager = NfcManager as typeof NfcManager & { isSupported(tech: NfcTech): Promise<boolean> };
  return manager.isSupported(NfcTech.MifareIOS);
}

/** Owns one explicit Core NFC session, including setup I/O and its asynchronous native reset. */
export class IosNfcSession {
  private active: { cancel(): void; result: Promise<NfcScanCaptureResult> } | null = null;

  constructor(
    private readonly start: () => Promise<void>,
    private readonly normalize: (tag: TagEvent) => NfcScanCaptureResult,
    private readonly timeoutMilliseconds: number,
  ) {}

  scan(action?: CapturedTagAction): Promise<NfcScanCaptureResult> {
    if (this.active !== null) return Promise.resolve({ status: 'unavailable' });
    let resolve!: (value: NfcScanCaptureResult) => void;
    const result = new Promise<NfcScanCaptureResult>((done) => { resolve = done; });
    let outcome: NfcScanCaptureResult | null = null;
    let requested = false;
    let closed = false;
    let workDone = false;
    let cancelDone = true;
    let resolved = false;
    let listening = false;
    let captureTimer: ReturnType<typeof setTimeout> | undefined;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;

    const settleIfDrained = () => {
      if (outcome === null || !workDone || !cancelDone || (requested && !closed)) return;
      clearTimeout(cleanupTimer);
      if (listening) NfcManager.setEventListener(NfcEvents.SessionClosed, null);
      if (this.active === active) this.active = null;
      if (!resolved) { resolved = true; resolve(outcome); }
    };
    const finish = (value: NfcScanCaptureResult) => {
      if (outcome !== null) return;
      outcome = value;
      clearTimeout(captureTimer);
      // A hung bridge must not hang the UI or lend the old cleanup to a newer session.
      // The owner remains occupied until both native reset and outstanding I/O drain.
      cleanupTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(value.status === 'captured' ? { status: 'unavailable' } : value);
        }
      }, 2_000);
      if (requested && !closed) {
        cancelDone = false;
        void NfcManager.cancelTechnologyRequest({ throwOnError: true })
          .catch(() => {
            // Core NFC can reject the request and reset before SessionClosed arrives.
            // A second cancellation then fails because that session is already gone.
            if (value.status !== 'cancelled' && value.status !== 'timed_out') {
              outcome = { status: 'unavailable' };
            }
          })
          .finally(() => { cancelDone = true; settleIfDrained(); });
      }
      settleIfDrained();
    };
    const active = { cancel: () => finish({ status: 'cancelled' }), result };
    this.active = active;
    captureTimer = setTimeout(() => finish({ status: 'timed_out' }), this.timeoutMilliseconds);
    void (async () => {
      try {
        if (!await isIosTagReaderSupported()) {
          finish({ status: 'unavailable' }); return;
        }
        if (outcome !== null) return;
        await this.start();
        if (outcome !== null) return;
        NfcManager.setEventListener(NfcEvents.SessionClosed, (error: unknown) => {
          closed = true;
          finish(error === null ? { status: 'cancelled' } : errorResult(error));
          settleIfDrained();
        });
        listening = true;
        requested = true;
        await NfcManager.requestTechnology(NfcTech.MifareIOS, {
          alertMessage: 'Halte dein iPhone an den Tag.',
        });
        if (outcome !== null) return;
        const tag = await NfcManager.getTag();
        if (outcome !== null) return;
        const capture = tag === null ? { status: 'unreadable' as const } : this.normalize(tag);
        if (capture.status === 'captured' && action !== undefined) await action(capture);
        if (outcome === null) finish(capture);
      } catch (error) {
        finish(errorResult(error));
      } finally {
        workDone = true;
        settleIfDrained();
      }
    })();
    return result;
  }

  async cancel(): Promise<void> {
    const active = this.active;
    if (active === null) return;
    active.cancel();
    await active.result;
  }
}

function errorResult(error: unknown): NfcScanCaptureResult {
  if (error instanceof NfcError.UserCancel) return { status: 'cancelled' };
  if (error instanceof NfcError.Timeout) return { status: 'timed_out' };
  return { status: 'unavailable' };
}
