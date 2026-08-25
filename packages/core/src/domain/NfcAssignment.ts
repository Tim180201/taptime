import type { NfcAssignmentId, NfcTagId, OrganizationId } from './ids';
import type { CustomerWorkTarget } from './AssignmentTarget';

interface NfcAssignmentBase {
  readonly id: NfcAssignmentId;
  readonly organizationId: OrganizationId;
  readonly nfcTagId: NfcTagId;
  readonly active: boolean;
}

export interface WorkNfcAssignment extends NfcAssignmentBase {
  /** Missing on legacy objects; absence remains canonical `work`. */
  readonly assignmentType?: 'work';
  readonly target: CustomerWorkTarget;
}

export interface BreakNfcAssignment extends NfcAssignmentBase {
  readonly assignmentType: 'break';
  readonly target?: never;
}

export type NfcAssignment = WorkNfcAssignment | BreakNfcAssignment;

export function isBreakNfcAssignment(
  assignment: NfcAssignment,
): assignment is BreakNfcAssignment {
  return assignment.assignmentType === 'break';
}
