import type { AssignmentValidationResult, AssignmentValidationRejectionReason } from './AssignmentValidationResult';
import type { ErrorCategory } from '../domain/ErrorCategory';

// DT-009. Pure, read-only classification against TTAP-001's error taxonomy - never triggers
// a side effect and never changes AssignmentValidator's behavior.
//
// Mapping rationale: 'employee_not_authenticated' is 'recoverable' - the employee's
// immediate next action (sign in) resolves it, mirroring classifyAuthenticationResult()'s
// 'invalid_credentials' mapping. The remaining three reasons
// ('employee_lacks_organization_access', 'missing_assignment_target',
// 'assignment_target_disabled') require an administrator to change data or permissions
// before this specific assignment/target could ever succeed - the scanning employee cannot
// self-correct by retrying or rescanning, so they are classified as 'fatal' (to this scan
// attempt, not to the application).
const REJECTION_CATEGORIES: Record<AssignmentValidationRejectionReason, ErrorCategory> = {
  employee_not_authenticated: 'recoverable',
  employee_lacks_organization_access: 'fatal',
  missing_assignment_target: 'fatal',
  assignment_target_disabled: 'fatal',
};

export function classifyAssignmentValidationResult(result: AssignmentValidationResult): ErrorCategory | null {
  if (result.status === 'accepted') {
    return null;
  }

  return REJECTION_CATEGORIES[result.reason];
}
