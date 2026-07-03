import type { NfcAssignment } from '../domain/NfcAssignment';
import type { Customer } from '../domain/Customer';
import type { CallerContext } from '../domain/CallerContext';

export type AssignmentValidationRejectionReason =
  | 'employee_not_authenticated'
  | 'employee_lacks_organization_access'
  | 'missing_assignment_target'
  | 'assignment_target_disabled';

export interface AcceptedAssignmentValidationResult {
  readonly status: 'accepted';
  readonly assignment: NfcAssignment;
  readonly target: Customer;
  readonly caller: Extract<CallerContext, { status: 'authenticated' }>;
}

export interface RejectedAssignmentValidationResult {
  readonly status: 'rejected';
  readonly assignment: NfcAssignment;
  readonly reason: AssignmentValidationRejectionReason;
}

// DT-003 scope is accepted/rejected only; deferred outcomes remain DT-004+ (Development
// Sprint 001 Plan, Section 9).
export type AssignmentValidationResult = AcceptedAssignmentValidationResult | RejectedAssignmentValidationResult;
