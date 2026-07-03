import type { NfcAssignmentId, NfcTagId, OrganizationId, UserId, WorkEventId } from './ids';
import type { AssignmentTarget } from './AssignmentTarget';
import type { Timestamp } from './Timestamp';

// TTAP-001 Aggregate Root. Invariants: belongs to exactly one Organization, is traceable
// to its triggering NfcTag/NfcAssignment, and to the caller who triggered it.
export interface WorkEvent {
  readonly id: WorkEventId;
  readonly organizationId: OrganizationId;
  readonly assignmentId: NfcAssignmentId;
  readonly nfcTagId: NfcTagId;
  readonly target: AssignmentTarget;
  readonly triggeredBy: UserId;
  readonly occurredAt: Timestamp;
}
