import type {
  CustomerId,
  MembershipId,
  MembershipRole,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
} from '@taptime/core';

export interface AdminOrganizationSummary {
  readonly id: OrganizationId;
  readonly name: string;
}

export interface AdminCustomerSummary {
  readonly id: CustomerId;
  readonly displayName: string;
  readonly active: boolean;
}

export interface AdminNfcTagSummary {
  readonly id: NfcTagId;
  readonly displayName: string;
  readonly validationFingerprint: string;
  readonly assignmentState: 'assigned' | 'unassigned';
  readonly assignmentType?: 'work' | 'break' | null;
  readonly targetCustomerId: CustomerId | null;
}

export interface AdminProjectedNfcTagSummary extends AdminNfcTagSummary {
  readonly activeAssignmentId: NfcAssignmentId | null;
}

export interface EmployeeMembershipSummary {
  readonly id: MembershipId;
  readonly displayName: string;
  readonly role: MembershipRole;
  readonly active: boolean;
  readonly rowVersion: number;
}

export interface LocatedEmployeeMembershipSummary extends EmployeeMembershipSummary {
  readonly location: { readonly id: string; readonly name: string } | null;
}

export interface CreateEmployeeMembershipInvitationCommand {
  readonly accessToken: string;
  readonly expectedMembershipId: MembershipId;
  readonly commandId: string;
  readonly displayName: string;
  readonly role: MembershipRole;
  readonly locationId?: string | null;
}

export interface RedeemEmployeeMembershipInvitationCommand {
  readonly accessToken: string;
  readonly commandId: string;
  readonly invitationSecret: string;
}

export interface ReadEmployeeMembershipsProjectionCommand {
  readonly accessToken: string;
  readonly expectedMembershipId: MembershipId;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface ReadEmployeeMembershipsProjectionV2Command
extends ReadEmployeeMembershipsProjectionCommand {
  readonly locationId: string | null;
}

export interface RevokeMembershipCommand {
  readonly accessToken: string;
  readonly expectedMembershipId: MembershipId;
  readonly commandId: string;
  readonly targetMembershipId: MembershipId;
  readonly expectedRowVersion: number;
}

export interface RecordPasswordResetCommand {
  readonly accessToken: string;
}

export type RecordPasswordResetResult =
  | { readonly status: 'succeeded' }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'forbidden' }
  | { readonly status: 'invalid_request' };

export interface ChangeMembershipRoleCommand extends RevokeMembershipCommand {
  readonly role: MembershipRole;
}

export type CreateEmployeeMembershipInvitationResult =
  | {
      readonly status: 'succeeded';
      readonly invitationSecret: string;
      readonly expiresAt: string;
    }
  | AdminAuthorityRejection
  | { readonly status: 'invitation_created_token_unavailable' }
  | { readonly status: 'invitation_limit_reached' }
  | { readonly status: 'command_id_conflict' }
  | { readonly status: 'invalid_request' };

export type RedeemEmployeeMembershipInvitationResult =
  | {
      readonly status: 'succeeded';
      readonly organizationName: string;
      readonly membershipDisplayName: string;
      readonly role: MembershipRole;
    }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'enrollment_unavailable' }
  | { readonly status: 'invalid_request' };

export type ReadEmployeeMembershipsProjectionResult =
  | {
      readonly status: 'succeeded';
      readonly organization: AdminOrganizationSummary;
      readonly employeeMemberships: readonly EmployeeMembershipSummary[];
      readonly nextCursor: string | null;
    }
  | AdminAuthorityRejection
  | { readonly status: 'invalid_request' };

export type ReadEmployeeMembershipsProjectionV2Result =
  | {
      readonly status: 'succeeded';
      readonly organization: AdminOrganizationSummary;
      readonly employeeMemberships: readonly LocatedEmployeeMembershipSummary[];
      readonly nextCursor: string | null;
    }
  | AdminAuthorityRejection
  | { readonly status: 'location_scope_forbidden' }
  | { readonly status: 'invalid_request' };

export type MembershipMutationResult =
  | {
      readonly status: 'succeeded';
      readonly membership: {
        readonly id: MembershipId;
        readonly role: MembershipRole;
        readonly active: boolean;
        readonly rowVersion: number;
      };
      readonly idempotentRetry: boolean;
    }
  | AdminAuthorityRejection
  | { readonly status: 'command_id_conflict' }
  | { readonly status: 'last_administrator' }
  | { readonly status: 'self_revocation_forbidden' }
  | { readonly status: 'stale_row_version' }
  | { readonly status: 'target_unavailable' }
  | { readonly status: 'invalid_request' };

export interface EmployeeEnrollmentCoordinatorControls {
  readonly deadlineEpochMilliseconds?: number;
  readonly beforeCommit?: () => Promise<void> | void;
}

export interface CreateCustomerCommand {
  readonly accessToken: string;
  readonly expectedMembershipId: MembershipId;
  readonly commandId: string;
  readonly displayName: string;
}

export interface ProvisionNfcTagCommand {
  readonly accessToken: string;
  readonly expectedMembershipId: MembershipId;
  readonly commandId: string;
  readonly customerId: CustomerId;
  readonly displayName: string;
  readonly canonicalPayload: string;
}

export interface ProvisionBreakNfcTagCommand {
  readonly accessToken: string;
  readonly expectedMembershipId: MembershipId;
  readonly commandId: string;
  readonly displayName: string;
  readonly canonicalPayload: string;
}

export interface ReadSetupProjectionCommand {
  readonly accessToken: string;
  readonly expectedMembershipId: MembershipId;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface ReassignNfcTagCommand {
  readonly accessToken: string;
  readonly expectedMembershipId: MembershipId;
  readonly commandId: string;
  readonly nfcTagId: NfcTagId;
  readonly expectedActiveAssignmentId: NfcAssignmentId;
  readonly targetCustomerId: CustomerId;
}

export type AdminAuthorityRejection =
  | { readonly status: 'unauthorized' }
  | { readonly status: 'forbidden' };

export type CreateCustomerResult =
  | {
      readonly status: 'succeeded';
      readonly idempotentRetry: boolean;
      readonly customer: AdminCustomerSummary;
    }
  | AdminAuthorityRejection
  | { readonly status: 'command_id_conflict' }
  | { readonly status: 'invalid_request' };

export type ProvisionNfcTagResult =
  | {
      readonly status: 'succeeded';
      readonly idempotentRetry: boolean;
      readonly nfcTag: AdminNfcTagSummary;
      readonly assignmentId: NfcAssignmentId;
    }
  | AdminAuthorityRejection
  | { readonly status: 'assignment_target_unavailable' }
  | { readonly status: 'tag_payload_already_registered' }
  | { readonly status: 'command_id_conflict' }
  | { readonly status: 'invalid_request' };

export type ProvisionBreakNfcTagResult =
  | {
      readonly status: 'succeeded';
      readonly idempotentRetry: boolean;
      readonly nfcTag: AdminNfcTagSummary;
      readonly assignmentId: NfcAssignmentId;
    }
  | AdminAuthorityRejection
  | { readonly status: 'tag_payload_already_registered' | 'command_id_conflict' | 'invalid_request' };

export type ReassignNfcTagResult =
  | {
      readonly status: 'succeeded';
      readonly idempotentRetry: boolean;
      readonly assignmentChanged: boolean;
      readonly resultAssignmentId: NfcAssignmentId;
      readonly replacedAssignmentId: NfcAssignmentId | null;
      readonly targetCustomerId: CustomerId;
      readonly effectiveAt: string | null;
    }
  | AdminAuthorityRejection
  | { readonly status: 'assignment_target_unavailable' }
  | { readonly status: 'assignment_conflict' }
  | { readonly status: 'assignment_in_use' }
  | { readonly status: 'command_id_conflict' }
  | { readonly status: 'invalid_request' };

export type ReadSetupProjectionResult =
  | {
      readonly status: 'succeeded';
      readonly organization: AdminOrganizationSummary;
      readonly customers: readonly AdminCustomerSummary[];
      readonly nfcTags: readonly AdminProjectedNfcTagSummary[];
      readonly nextCursor: string | null;
    }
  | AdminAuthorityRejection
  | { readonly status: 'invalid_request' };

export type AdminWriteStage =
  | 'customer_and_audit'
  | 'nfc_tag_and_audit'
  | 'nfc_assignment_and_audit'
  | 'receipt';

export interface AdminCoordinatorControls {
  readonly deadlineEpochMilliseconds?: number;
  readonly afterAuthorityLocked?: () => Promise<void> | void;
  readonly afterCommandLocked?: () => Promise<void> | void;
  readonly afterReceiptMiss?: () => Promise<void> | void;
  readonly afterWrite?: (stage: AdminWriteStage) => Promise<void> | void;
  readonly beforeCommit?: () => Promise<void> | void;
}

export type ReassignmentWriteStage =
  | 'old_assignment_and_audit'
  | 'new_assignment_and_audit'
  | 'receipt';

export interface ReassignmentCoordinatorControls {
  readonly deadlineEpochMilliseconds?: number;
  readonly afterAuthorityLocked?: () => Promise<void> | void;
  readonly afterCommandLocked?: () => Promise<void> | void;
  readonly afterReceiptMiss?: () => Promise<void> | void;
  readonly afterAssignmentLocked?: () => Promise<void> | void;
  readonly afterWrite?: (stage: ReassignmentWriteStage) => Promise<void> | void;
  readonly beforeCommit?: () => Promise<void> | void;
}
