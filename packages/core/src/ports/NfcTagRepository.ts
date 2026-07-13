import type { NfcTag } from '../domain/NfcTag';
import type { NfcPayload } from '../domain/NfcPayload';

export interface NfcTagRepository {
  findByPayload(payload: NfcPayload): Promise<NfcTag | null>;
  register(nfcTag: NfcTag): Promise<void>;
}
