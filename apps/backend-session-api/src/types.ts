import type { MembershipId, MembershipRole, OrganizationId, UserId } from '@taptime/core';

export interface ResolvedProductSession {
  readonly userId: UserId;
  readonly membershipId: MembershipId;
  readonly organizationId: OrganizationId;
  readonly role: MembershipRole;
}

export type SessionAuthorityResolution =
  | { readonly status: 'resolved'; readonly session: ResolvedProductSession }
  | { readonly status: 'rejected' };

export interface SessionAuthorityResolver {
  resolve(accessToken: string): Promise<SessionAuthorityResolution>;
}

export interface SessionApiDiagnostic {
  readonly code: 'session_resolution_failed';
  readonly correlationId: string;
}

export type SessionApiDiagnosticSink = (diagnostic: SessionApiDiagnostic) => void;
