import type { OrganizationId, UserId } from './ids';

// The pipeline receives caller identity, it does not establish one (Development Sprint 001
// Plan, Section 7). "unauthenticated" models the case where no valid caller was supplied.
export type CallerContext =
  | { readonly status: 'authenticated'; readonly userId: UserId; readonly organizationId: OrganizationId }
  | { readonly status: 'unauthenticated' };

export function authenticatedCaller(userId: UserId, organizationId: OrganizationId): CallerContext {
  return { status: 'authenticated', userId, organizationId };
}

export const UNAUTHENTICATED_CALLER: CallerContext = { status: 'unauthenticated' };
