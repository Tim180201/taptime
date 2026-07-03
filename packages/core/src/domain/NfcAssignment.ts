import type { NfcAssignmentId, NfcTagId, OrganizationId } from './ids';
import type { AssignmentTarget } from './AssignmentTarget';

export interface NfcAssignment {
  readonly id: NfcAssignmentId;
  readonly organizationId: OrganizationId;
  readonly nfcTagId: NfcTagId;
  readonly target: AssignmentTarget;
  readonly active: boolean;
}
