import type { NfcTagId, OrganizationId } from './ids';
import type { NfcPayload } from './NfcPayload';

export interface NfcTag {
  readonly id: NfcTagId;
  readonly organizationId: OrganizationId;
  readonly displayName: string;
  readonly payload: NfcPayload;
}
