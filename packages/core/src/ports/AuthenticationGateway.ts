import type { AuthenticationResult } from '../application/AuthenticationResult';

// A single opaque sign-in code, not a username/password pair - this sprint builds no
// password flow, no registration, no credential management (Development Sprint 007 Plan,
// Section 7).
export interface Credentials {
  readonly signInCode: string;
}

// DT-013. Represents the eventual managed authentication provider ADR-0007 approves as a
// category, without committing to one (the specific provider remains a Human Architect
// decision, not yet made). Must not make or alter any business decision - it only ever
// authenticates or rejects a credential (ADR-0006 domain-first boundary).
export interface AuthenticationGateway {
  authenticate(credentials: Credentials): Promise<AuthenticationResult>;
}
