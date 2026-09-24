import NfcManager, { NfcError, NfcEvents, NfcTech, type TagEvent } from 'react-native-nfc-manager';
import { Alert } from 'react-native';
import type { NfcScanCaptureResult } from '@taptime/core';
import { recordNfcDiagnostic, type NfcDiagnosticPhase } from './IosNfcDiagnostics';

export type CapturedTagAction = (capture: Extract<NfcScanCaptureResult, { status: 'captured' }>) => Promise<void>;

export function isIosTagReaderSupported(): Promise<boolean> {
  // 3.17.2 implements the technology argument in JS/native but omits it from index.d.ts.
  const manager = NfcManager as typeof NfcManager & { isSupported(tech: NfcTech): Promise<boolean> };
  return manager.isSupported(NfcTech.MifareIOS);
}

/** Owns one explicit Core NFC session, including setup I/O and its asynchronous native reset. */
export class IosNfcSession {
  private active: { cancel(): void; result: Promise<NfcScanCaptureResult>; delivered(): boolean } | null = null;

  constructor(
    private readonly start: () => Promise<void>,
    private readonly normalize: (tag: TagEvent) => NfcScanCaptureResult,
    private readonly timeoutMilliseconds: number,
  ) {}

  scan(action?: CapturedTagAction): Promise<NfcScanCaptureResult> {
    if (this.active !== null) {
      if (!this.active.delivered()) return Promise.resolve({ status: 'unavailable' });
      Alert.alert('Scan wird noch abgeschlossen',
        'Bitte warte einen Moment und versuche es erneut. Bleibt dieser Hinweis bestehen, schließe die App vollständig und öffne sie wieder.');
      // This new attempt did not open a reader or capture anything.
      return Promise.resolve({ status: 'cancelled' });
    }
    const startedAt = performance.now();
    const diagnose = (phase: NfcDiagnosticPhase, code = -1) => {
      recordNfcDiagnostic(phase, Math.max(0, Math.floor(performance.now() - startedAt)), code);
    };
    let resolve!: (value: NfcScanCaptureResult) => void;
    const result = new Promise<NfcScanCaptureResult>((done) => { resolve = done; });
    let outcome: NfcScanCaptureResult | null = null;
    let requested = false;
    let closed = false;
    let workDone = false;
    let cancelDone = true;
    let cancelSucceeded = false;
    let resolved = false;
    let listening = false;
    let captureTimer: ReturnType<typeof setTimeout> | undefined;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;

    const settleIfDrained = () => {
      if (outcome === null || !workDone || !cancelDone) return;
      // A successful invalidation acknowledges the completed read/write. Its later
      // delegate reset governs ownership only, not whether the captured tag exists.
      if (!resolved && (!requested || closed || cancelSucceeded)) {
        resolved = true;
        resolve(outcome);
      }
      if (requested && !closed) return;
      clearTimeout(cleanupTimer);
      if (listening) NfcManager.setEventListener(NfcEvents.SessionClosed, null);
      if (this.active === active) this.active = null;
    };
    const finish = (value: NfcScanCaptureResult) => {
      if (outcome !== null) return;
      outcome = value;
      clearTimeout(captureTimer);
      // A hung bridge must not hang the UI or lend the old cleanup to a newer session.
      // This deadline bounds the UI only, never native ownership: the manager resets
      // global state in didInvalidate, with no session identity check or delivery bound.
      cleanupTimer = setTimeout(() => {
        diagnose('deadline_expired');
        if (!resolved) {
          resolved = true;
          resolve(value.status === 'captured' ? { status: 'unavailable' } : value);
        }
      }, 2_000);
      if (requested && !closed) {
        cancelDone = false;
        void NfcManager.cancelTechnologyRequest({ throwOnError: true })
          .then(() => { cancelSucceeded = true; diagnose('cancel_ok'); })
          .catch(() => {
            diagnose('cancel_failed');
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
    const active = { cancel: () => finish({ status: 'cancelled' }), result, delivered: () => resolved };
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
          diagnose('session_closed', sessionClosedCode(error));
          closed = true;
          finish(error === null ? { status: 'cancelled' } : errorResult(error));
          settleIfDrained();
        });
        listening = true;
        requested = true;
        diagnose('requested');
        await NfcManager.requestTechnology(NfcTech.MifareIOS, {
          alertMessage: 'Halte dein iPhone an den Tag.',
        });
        diagnose('connected');
        if (outcome !== null) return;
        const tag = await NfcManager.getTag();
        diagnose('read');
        if (outcome !== null) return;
        const capture = tag === null ? { status: 'unreadable' as const } : this.normalize(tag);
        if (capture.status === 'captured' && action !== undefined) {
          await action(capture);
          diagnose('action_finished');
        }
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

// Manager 3.17.2 strips the native code, converting 200 to null and the others
// to empty Error subclasses. Never log a message or arbitrary error property.
function sessionClosedCode(error: unknown): number {
  if (error === null || error instanceof NfcError.UserCancel) return 200;
  if (error instanceof NfcError.Timeout) return 201;
  const known = [
    ['UnsupportedFeature', 1], ['SecurityViolation', 2], ['InvalidParameter', 3],
    ['InvalidParameterLength', 4], ['ParameterOutOfBound', 5], ['RadioDisabled', 6],
    ['TagConnectionLost', 100], ['RetryExceeded', 101], ['TagResponseError', 102],
    ['SessionInvalidated', 103], ['TagNotConnected', 104], ['PacketTooLong', 105],
    ['Unexpected', 202], ['SystemBusy', 203], ['FirstNdefInvalid', 204],
    ['InvalidConfiguration', 300], ['TagNotWritable', 400], ['TagUpdateFailure', 401],
    ['TagSizeTooSmall', 402], ['ZeroLengthMessage', 403],
  ] as const;
  for (const [name, code] of known) {
    const kind = NfcError[name];
    if (typeof kind === 'function' && error instanceof kind) return code;
  }
  return -1;
}

function errorResult(error: unknown): NfcScanCaptureResult {
  if (error instanceof NfcError.UserCancel) return { status: 'cancelled' };
  if (error instanceof NfcError.Timeout) return { status: 'timed_out' };
  return { status: 'unavailable' };
}
