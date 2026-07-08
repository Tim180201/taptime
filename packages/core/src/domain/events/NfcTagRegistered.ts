import type { NfcTag } from '../NfcTag';

export interface NfcTagRegistered {
  readonly type: 'NfcTagRegistered';
  readonly nfcTag: NfcTag;
}

export function nfcTagRegistered(nfcTag: NfcTag): NfcTagRegistered {
  return { type: 'NfcTagRegistered', nfcTag };
}
