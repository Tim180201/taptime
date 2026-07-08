import type { OrganizationId } from './ids';

// DT-017 (TS-002 Domain Model). Minimal shape: an identifier plus a human-readable name. No
// `status` field - no Decision Logic in FB-002 references an "inactive Organization"
// rejection path; a pure additive field change later if that ever changes (ADR-0006
// domain-first rule).
export interface Organization {
  readonly id: OrganizationId;
  readonly name: string;
}
