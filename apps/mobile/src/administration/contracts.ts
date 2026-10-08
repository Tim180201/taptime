import type { InternalAuthenticatedSessionSnapshot } from '../auth/contracts';
import type { TagWriteFailureReason } from './NfcTagWriter';

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
  readonly assignmentType: 'work' | 'break' | null;
  readonly targetCustomerId: string | null;
  readonly activeAssignmentId: string | null;
}

export interface AdminSetupProjection {
  readonly organization: { readonly id: string; readonly name: string };
  readonly customers: readonly AdminCustomerSummary[];
  readonly nfcTags: readonly AdminNfcTagSummary[];
  readonly nextCursor: string | null;
}

export type CustomerCreationOptions =
  | { readonly status: 'ready'; readonly locationsEnabled: boolean; readonly locations: readonly { readonly id: string; readonly displayName: string }[] }
  | { readonly status: 'offline' | 'unavailable' | 'authority_rejected' };
export type CreateAdminCustomerResult =
  | { readonly status: 'succeeded'; readonly customer: AdminCustomerSummary }
  | { readonly status: 'location_required' | 'forbidden' | 'invalid_request' | 'command_id_conflict' }
  | AdminTransportFailure;

export type AdminSetupOutcome =
  | {readonly status:'tag_checked';readonly assignment:'customer'|'break'|'unassigned';readonly customerName:string|null;readonly locationName:string|null}
  | { readonly status: 'customer_created'; readonly customerId: string; readonly refreshFailed: boolean }
  | { readonly status: 'customer_offline' | 'customer_location_required' | 'customer_forbidden' | 'customer_request_failed' }

  | { readonly status: 'tag_write_failed'; readonly reason: TagWriteFailureReason }
  | { readonly status: 'tag_provisioned'; readonly validationFingerprint: string }
  | { readonly status: 'unreadable' | 'timed_out' | 'cancelled' | 'nfc_unavailable' }
  | { readonly status: 'invalid_input' | 'tag_already_registered' | 'customer_unavailable' }
  | { readonly status: 'setup_offline' | 'session_rejected' | 'request_failed' };

export type AdminSetupState = { readonly pendingTag?: { readonly customerId: string | null; readonly displayName: string } } & (
  | { readonly status: 'inactive' }
  | { readonly status: 'loading' }
  | { readonly status: 'not_authorized' }
  | { readonly status: 'ready'; readonly projection: AdminSetupProjection; readonly outcome: AdminSetupOutcome | null }
  | { readonly status: 'capturing'; readonly projection: AdminSetupProjection }
  | { readonly status: 'writing'; readonly projection: AdminSetupProjection }
  | { readonly status: 'creating_customer'; readonly projection: AdminSetupProjection }
  | { readonly status: 'submitting'; readonly projection: AdminSetupProjection });

export interface AdminSetupCapability {
  inspectTag?():Promise<void>;
  manageCustomer?(customerId:string,change:import('@taptime/mobile-work-contract').CustomerManagementChange):Promise<import('@taptime/mobile-work-contract').ManageCustomerResult>;
  prepareCustomer(): Promise<CustomerCreationOptions>;
  createCustomer(displayName: string, locationId?: string): Promise<void>;
  getState(): AdminSetupState;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  provision(customerId: string, displayName: string): Promise<void>;
  provisionBreak(displayName: string): Promise<void>;
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
  inspectTag?(command:import('@taptime/mobile-work-contract').InspectTagRequest):Promise<import('@taptime/mobile-work-contract').InspectTagResult>;
  manageCustomer?(request:import('@taptime/mobile-work-contract').ManageCustomerRequest):Promise<import('@taptime/mobile-work-contract').ManageCustomerResult>;
  createCustomer?(command: { readonly expectedMembershipId: string; readonly commandId: string;
    readonly displayName: string; readonly locationId?: string }): Promise<CreateAdminCustomerResult>;
  readCustomerLocations?(expectedMembershipId: string, cursor: string | null): Promise<
    | { readonly status: 'succeeded'; readonly locations: readonly { readonly id: string; readonly displayName: string }[]; readonly nextCursor: string | null }
    | AdminTransportFailure>;

  readProjection(expectedMembershipId: string, cursor: string | null): Promise<AdminProjectionResult>;
  provisionTag(command: {
    readonly expectedMembershipId: string;
    readonly commandId: string;
    readonly customerId: string;
    readonly displayName: string;
    readonly canonicalPayload: string;
  }): Promise<ProvisionAdminTagResult>;
  provisionBreakTag?(command: {
    readonly expectedMembershipId: string;
    readonly commandId: string;
    readonly displayName: string;
    readonly canonicalPayload: string;
  }): Promise<ProvisionAdminTagResult>;
}
