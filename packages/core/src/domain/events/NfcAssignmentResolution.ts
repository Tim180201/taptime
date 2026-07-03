import type { NfcAssignment } from '../NfcAssignment';
import type { NfcPayload } from '../NfcPayload';

export type AssignmentResolutionRejectionReason = 'unknown_tag' | 'inactive_assignment';

export interface NfcAssignmentResolved {
  readonly type: 'NfcAssignmentResolved';
  readonly assignment: NfcAssignment;
}

export interface NfcAssignmentRejected {
  readonly type: 'NfcAssignmentRejected';
  readonly payload: NfcPayload;
  readonly reason: AssignmentResolutionRejectionReason;
}

// TTAP-001 Domain Events: NfcAssignmentResolved / NfcAssignmentRejected.
export type NfcAssignmentResolution = NfcAssignmentResolved | NfcAssignmentRejected;

export function nfcAssignmentResolved(assignment: NfcAssignment): NfcAssignmentResolved {
  return { type: 'NfcAssignmentResolved', assignment };
}

export function nfcAssignmentRejected(
  payload: NfcPayload,
  reason: AssignmentResolutionRejectionReason,
): NfcAssignmentRejected {
  return { type: 'NfcAssignmentRejected', payload, reason };
}
