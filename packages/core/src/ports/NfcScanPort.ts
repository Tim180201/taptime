import type { NfcPayload } from '../domain/NfcPayload';
import type { Timestamp } from '../domain/Timestamp';

export type NfcScanCaptureResult =
  | {
      readonly status: 'captured';
      readonly payload: NfcPayload;
      /** Native discovery time when supplied by a physical adapter. */
      readonly capturedAt?: Timestamp;
    }
  | { readonly status: 'unreadable' }
  | { readonly status: 'timed_out' }
  | { readonly status: 'cancelled' }
  | { readonly status: 'unavailable' };

// Contract implemented by both the fake test double (Development Sprint 001) and the future
// real NFC SDK adapter. Swapping implementations must not require changes above this boundary.
export interface NfcScanPort {
  scan(): Promise<NfcScanCaptureResult>;
}
