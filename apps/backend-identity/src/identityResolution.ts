import type {
  MembershipId,
  MembershipRole,
  OrganizationId,
  UserId,
} from '@taptime/core';
import type {
  AccessTokenVerificationRejectionReason,
  VerifiedProviderIdentity,
} from './accessToken.js';

export interface ResolvedIdentityMembership {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly membershipId: MembershipId;
  readonly role: MembershipRole;
}

export type IdentityMembershipResolutionResult =
  | {
      readonly status: 'resolved';
      readonly membership: ResolvedIdentityMembership;
    }
  | {
      readonly status: 'not_resolved';
    };

export interface IdentityMembershipResolver {
  resolve(identity: VerifiedProviderIdentity): Promise<IdentityMembershipResolutionResult>;
}

export type AdministrationSection =
  | 'setup'
  | 'employees'
  | 'time_records'
  | 'time_export'
  | 'review_items';

export type AdministrationManagementScope =
  | { readonly kind: 'organization' }
  | {
      readonly kind: 'locations';
      readonly locations: readonly {
        readonly id: string;
        readonly name: string;
      }[];
    };

export interface AdministrationSessionProjection {
  readonly locationsEnabled: boolean;
  readonly availableSections: readonly AdministrationSection[];
  readonly managementScope: AdministrationManagementScope;
}

export type AdministrationSessionProjectionResult =
  | { readonly status: 'resolved'; readonly projection: AdministrationSessionProjection }
  | { readonly status: 'not_resolved' };

export interface AdministrationSessionProjectionResolver {
  resolveAdministrationSession(
    membership: ResolvedIdentityMembership,
  ): Promise<AdministrationSessionProjectionResult>;
}

export interface RequestActorContext {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly membershipId: MembershipId;
  readonly role: MembershipRole;
}

export interface ResolveRequestActorCommand {
  readonly accessToken: string;
  readonly requestedOrganizationId: OrganizationId;
}

export type RequestActorResolutionResult =
  | {
      readonly status: 'accepted';
      readonly actor: RequestActorContext;
    }
  | {
      readonly status: 'rejected';
      readonly reason: 'access_token_rejected';
      readonly tokenReason: AccessTokenVerificationRejectionReason;
    }
  | {
      readonly status: 'rejected';
      readonly reason: 'identity_or_membership_unavailable';
    }
  | {
      readonly status: 'rejected';
      readonly reason: 'requested_organization_mismatch';
    };
