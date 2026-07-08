import type { NfcAssignment } from '../NfcAssignment';

export interface NfcTagAssigned {
  readonly type: 'NfcTagAssigned';
  readonly nfcAssignment: NfcAssignment;
}

export function nfcTagAssigned(nfcAssignment: NfcAssignment): NfcTagAssigned {
  return { type: 'NfcTagAssigned', nfcAssignment };
}
