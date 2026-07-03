import type { NfcPayload } from '../domain/NfcPayload';

export type NfcScanCaptureResult =
  | { readonly status: 'captured'; readonly payload: NfcPayload }
  | { readonly status: 'unreadable' };

// Contract implemented by both the fake test double (Development Sprint 001) and the future
// real NFC SDK adapter. Swapping implementations must not require changes above this boundary.
export interface NfcScanPort {
  scan(): NfcScanCaptureResult;
}
