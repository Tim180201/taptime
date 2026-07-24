import type { NfcAssignmentId, NfcTagId, OrganizationId } from './ids';
import type { CustomerWorkTarget } from './AssignmentTarget';

export interface NfcAssignment {
  readonly id: NfcAssignmentId;
  readonly organizationId: OrganizationId;
  readonly nfcTagId: NfcTagId;
  readonly target: CustomerWorkTarget;
  readonly active: boolean;
}
