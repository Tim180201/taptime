import type { InternalAuthenticatedSessionSnapshot } from '../auth/contracts';

export interface AdminCustomerSummary {
  readonly id: string;
  readonly displayName: string;
  readonly active: boolean;
}

export interface AdminNfcTagSummary {
  readonly id: string;
  readonly displayName: string;
  readonly validationFingerprint: string;
  readonly assignmentState: 'assigned' | 'unassigned';
  readonly targetCustomerId: string | null;
}

export interface AdminSetupProjection {
  readonly organization: { readonly id: string; readonly name: string };
  readonly customers: readonly AdminCustomerSummary[];
  readonly nfcTags: readonly AdminNfcTagSummary[];
}

export type AdminSetupOutcome =
  | { readonly status: 'tag_provisioned'; readonly validationFingerprint: string }
  | { readonly status: 'unreadable' | 'timed_out' | 'cancelled' | 'nfc_unavailable' }
  | { readonly status: 'invalid_input' | 'tag_already_registered' | 'customer_unavailable' }
  | { readonly status: 'session_rejected' | 'request_failed' };

export type AdminSetupState =
  | { readonly status: 'inactive' }
  | { readonly status: 'loading' }
  | { readonly status: 'not_administrator' }
  | { readonly status: 'ready'; readonly projection: AdminSetupProjection; readonly outcome: AdminSetupOutcome | null }
  | { readonly status: 'capturing'; readonly projection: AdminSetupProjection }
  | { readonly status: 'submitting'; readonly projection: AdminSetupProjection };

export interface AdminSetupCapability {
  getState(): AdminSetupState;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  provision(customerId: string, displayName: string): Promise<void>;
  cancel(): Promise<void>;
}

export type AdminSessionSnapshot = InternalAuthenticatedSessionSnapshot;

export interface AdminSessionContextReader {
  capture(): AdminSessionSnapshot | null;
  isCurrent(snapshot: AdminSessionSnapshot): boolean;
  subscribe(listener: () => void): () => void;
}

export type AdminTransportFailure =
  | { readonly status: 'authority_rejected' | 'transient_failure' | 'unavailable' };

export type AdminProjectionResult =
  | ({ readonly status: 'succeeded' } & AdminSetupProjection)
  | AdminTransportFailure;

export type ProvisionAdminTagResult =
  | { readonly status: 'succeeded'; readonly validationFingerprint: string }
  | { readonly status: 'invalid_request' | 'assignment_target_unavailable' | 'tag_payload_already_registered' | 'command_id_conflict' }
  | AdminTransportFailure;

export interface AdminSetupApiPort {
  readProjection(expectedMembershipId: string): Promise<AdminProjectionResult>;
  provisionTag(command: {
    readonly expectedMembershipId: string;
    readonly commandId: string;
    readonly customerId: string;
    readonly displayName: string;
    readonly canonicalPayload: string;
  }): Promise<ProvisionAdminTagResult>;
}
