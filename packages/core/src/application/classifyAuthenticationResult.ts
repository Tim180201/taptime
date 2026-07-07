import type { AuthenticationResult } from './AuthenticationResult';
import type { ErrorCategory } from '../domain/ErrorCategory';

// DT-009. 'invalid_credentials' is 'recoverable' - the employee's immediate next action
// (enter a different/correct sign-in code) resolves it, mirroring
// classifyAssignmentValidationResult()'s 'employee_not_authenticated' mapping.
export function classifyAuthenticationResult(result: AuthenticationResult): ErrorCategory | null {
  if (result.status === 'authenticated') {
    return null;
  }

  return 'recoverable';
}
