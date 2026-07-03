import type { NfcTag } from '../domain/NfcTag';
import type { NfcPayload } from '../domain/NfcPayload';

export interface NfcTagRepository {
  findByPayload(payload: NfcPayload): NfcTag | null;
}
