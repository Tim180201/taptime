import type {
  AssignmentTarget,
  MembershipId,
  MembershipRole,
  NfcAssignmentId,
  NfcPayload,
  NfcTagId,
  OrganizationId,
  UserId,
} from '@taptime/core';
import type {
  DeferredLifecycleIngestionResult,
  LifecycleIngestionCommand,
  LifecycleIngestionResult,
} from '@taptime/backend-lifecycle';
import type {
  AdminCoordinatorControls,
  CreateCustomerCommand,
  CreateCustomerResult,
  ProvisionNfcTagCommand,
  ProvisionNfcTagResult,
  ReadSetupProjectionCommand,
  ReadSetupProjectionResult,
} from '@taptime/backend-administration';

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

export interface ResolvedScanContext {
  readonly assignmentId: NfcAssignmentId;
  readonly nfcTagId: NfcTagId;
  readonly target: AssignmentTarget;
}

export interface ScanContextResolutionCommand {
  readonly accessToken: string;
  readonly requestedOrganizationId: OrganizationId;
  readonly payload: NfcPayload;
}

export type ScanContextResolution =
  | { readonly status: 'resolved'; readonly context: ResolvedScanContext }
  | { readonly status: 'not_resolved' }
  | { readonly status: 'rejected' };

export interface ScanContextResolver {
  resolve(command: ScanContextResolutionCommand): Promise<ScanContextResolution>;
}

export interface LifecycleIngestor {
  ingest(
    command: LifecycleIngestionCommand,
    expectedMembershipId?: MembershipId,
  ): Promise<LifecycleIngestionResult>;
}

export interface DeferredLifecycleIngestor {
  ingestDeferred(
    command: LifecycleIngestionCommand,
    expectedMembershipId: MembershipId,
  ): Promise<DeferredLifecycleIngestionResult>;
}

export interface AdministrationCoordinator {
  createCustomer(
    command: CreateCustomerCommand,
    controls?: AdminCoordinatorControls,
  ): Promise<CreateCustomerResult>;

  provisionNfcTag(
    command: ProvisionNfcTagCommand,
    controls?: AdminCoordinatorControls,
  ): Promise<ProvisionNfcTagResult>;

  readSetupProjection(
    command: ReadSetupProjectionCommand,
    controls?: AdminCoordinatorControls,
  ): Promise<ReadSetupProjectionResult>;
}

export interface BackendApiDependencies {
  readonly sessionAuthority: SessionAuthorityResolver;
  readonly scanContextResolver: ScanContextResolver;
  readonly lifecycleIngestor: LifecycleIngestor;
  readonly deferredLifecycleIngestor: DeferredLifecycleIngestor;
  readonly administration: AdministrationCoordinator;
}

export interface BackendApiDiagnostic {
  readonly code:
    | 'administration_failed'
    | 'lifecycle_ingestion_failed'
    | 'scan_context_resolution_failed'
    | 'session_resolution_failed';
  readonly correlationId: string;
}

export type BackendApiDiagnosticSink = (diagnostic: BackendApiDiagnostic) => void;

// C1 names remain aliases so its published private regression contract stays source-compatible.
export type SessionApiDiagnostic = BackendApiDiagnostic;
export type SessionApiDiagnosticSink = BackendApiDiagnosticSink;
