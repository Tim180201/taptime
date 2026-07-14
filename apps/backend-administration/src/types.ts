import type {
  CustomerId,
  MembershipId,
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
  readonly targetCustomerId: CustomerId | null;
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

export interface ReadSetupProjectionCommand {
  readonly accessToken: string;
  readonly expectedMembershipId: MembershipId;
  readonly cursor: string | null;
  readonly limit: number;
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

export type ReadSetupProjectionResult =
  | {
      readonly status: 'succeeded';
      readonly organization: AdminOrganizationSummary;
      readonly customers: readonly AdminCustomerSummary[];
      readonly nfcTags: readonly AdminNfcTagSummary[];
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
