import type { AuthenticationGateway, Credentials } from '../ports/AuthenticationGateway';
import type { AuthenticationResult } from './AuthenticationResult';
import { authenticatedCaller, UNAUTHENTICATED_CALLER, type CallerContext } from '../domain/CallerContext';

// DT-013. Calls the AuthenticationGateway and forwards its result faithfully - it does not
// itself decide anything beyond "did the gateway say authenticated or not" (mirrors
// SynchronizationService's orchestration-only boundary, EP-008 Ch03 5.4). No role/permission
// logic, no persistence, no session storage beyond the caller's own lifetime.
export class SessionService {
  constructor(private readonly authenticationGateway: AuthenticationGateway) {}

  async signIn(credentials: Credentials): Promise<AuthenticationResult> {
    return await this.authenticationGateway.authenticate(credentials);
  }
}

// Produces the exact CallerContext shape AssignmentValidator already expects, using the
// existing, unchanged authenticatedCaller()/UNAUTHENTICATED_CALLER helpers - no new identity
// type is introduced (Development Sprint 007 Plan, Section 6).
export function toCallerContext(result: AuthenticationResult): CallerContext {
  if (result.status === 'authenticated') {
    return authenticatedCaller(result.userId, result.organizationId);
  }

  return UNAUTHENTICATED_CALLER;
}
