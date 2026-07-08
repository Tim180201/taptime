import type { NfcAssignment } from '../domain/NfcAssignment';
import type { NfcTagId } from '../domain/ids';

export interface NfcAssignmentRepository {
  findActiveByTagId(nfcTagId: NfcTagId): NfcAssignment | null;
  save(nfcAssignment: NfcAssignment): void;
}
