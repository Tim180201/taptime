import type { Membership } from '../domain/Membership';

export type MembershipAuthorizationRejectionReason =
  | 'membership_not_found'
  | 'membership_lacks_administrator_role'
  | 'cross_organization_access';

export interface AcceptedMembershipAuthorizationResult {
  readonly status: 'accepted';
  readonly membership: Membership;
}

export interface RejectedMembershipAuthorizationResult {
  readonly status: 'rejected';
  readonly reason: MembershipAuthorizationRejectionReason;
}

// DT-019 scope is accepted/rejected only, mirroring AssignmentValidationResult's shape.
export type MembershipAuthorizationResult =
  | AcceptedMembershipAuthorizationResult
  | RejectedMembershipAuthorizationResult;
