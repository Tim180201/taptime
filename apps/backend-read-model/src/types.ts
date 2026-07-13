import type {
  CustomerRepository,
  MembershipRepository,
  NfcAssignmentRepository,
  NfcTagRepository,
  OrganizationId,
  OrganizationRepository,
} from '@taptime/core';
import type { AccessTokenVerificationRejectionReason } from '@taptime/backend-identity';

export type ReadOnlyOrganizationRepository = Pick<OrganizationRepository, 'findById'>;
export type ReadOnlyMembershipRepository = Pick<MembershipRepository, 'findByUserId'>;
export type ReadOnlyCustomerRepository = Pick<CustomerRepository, 'findById'>;
export type ReadOnlyNfcTagRepository = Pick<NfcTagRepository, 'findByPayload'>;
export type ReadOnlyNfcAssignmentRepository = Pick<
  NfcAssignmentRepository,
  'findActiveByTagId'
>;

export interface TenantReadRepositories {
  readonly organization: ReadOnlyOrganizationRepository;
  readonly membership: ReadOnlyMembershipRepository;
  readonly customer: ReadOnlyCustomerRepository;
  readonly nfcTag: ReadOnlyNfcTagRepository;
  readonly nfcAssignment: ReadOnlyNfcAssignmentRepository;
}

export interface TenantReadSessionCommand {
  readonly accessToken: string;
  readonly requestedOrganizationId: OrganizationId;
}

export type TenantReadSessionResult<Value> =
  | {
      readonly status: 'accepted';
      readonly value: Value;
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
