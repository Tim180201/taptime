import type { NfcPayload } from '../NfcPayload';
import type { Timestamp } from '../Timestamp';

// A fact describes what happened. It carries no business meaning (EP-008 Ch01 7.3).
export interface NfcTagScanned {
  readonly type: 'NfcTagScanned';
  readonly payload: NfcPayload;
  readonly scannedAt: Timestamp;
}

export function nfcTagScanned(payload: NfcPayload, scannedAt: Timestamp): NfcTagScanned {
  return { type: 'NfcTagScanned', payload, scannedAt };
}
