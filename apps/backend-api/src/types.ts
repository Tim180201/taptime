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
  OfflineCaptureLeaseIssuer,
  OfflineEventReconciliationReader,
  OfflineLifecycleIngestor,
} from '@taptime/backend-offline-sync';
import type {
  AdminCoordinatorControls,
  CreateEmployeeMembershipInvitationCommand,
  CreateEmployeeMembershipInvitationResult,
  ChangeMembershipRoleCommand,
  CreateCustomerCommand,
  CreateCustomerResult,
  EmployeeEnrollmentCoordinatorControls,
  ProvisionNfcTagCommand,
  ProvisionNfcTagResult,
  ProvisionBreakNfcTagCommand,
  ProvisionBreakNfcTagResult,
  ReassignNfcTagCommand,
  ReassignNfcTagResult,
  ReadEmployeeMembershipsProjectionCommand,
  ReadEmployeeMembershipsProjectionResult,
  ReadSetupProjectionCommand,
  ReadSetupProjectionResult,
  RevokeMembershipCommand,
  MembershipMutationResult,
  RecordPasswordResetCommand,
  RecordPasswordResetResult,
  ReassignmentCoordinatorControls,
  RedeemEmployeeMembershipInvitationCommand,
  RedeemEmployeeMembershipInvitationResult,
} from '@taptime/backend-administration';
import type { TimeEntryExporter } from '@taptime/backend-time-export';
import type { TimeReviewPort } from '@taptime/backend-time-review';
import type {
  MobileWorkReader,
  ProjectAdministrationPort,
} from '@taptime/backend-mobile-work';
import type {
  ManualBreakLifecycleIngestionCommand,
  ManualLifecycleIngestionCommand,
} from '@taptime/backend-lifecycle';

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
  readonly subject:
    | { readonly type: 'work'; readonly target: AssignmentTarget }
    | { readonly type: 'break' };
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

export interface ManualLifecycleIngestor {
  ingestManual(command: ManualLifecycleIngestionCommand): Promise<LifecycleIngestionResult>;
  ingestManualBreak(command: ManualBreakLifecycleIngestionCommand): Promise<LifecycleIngestionResult>;
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
  provisionBreakNfcTag?(
    command: ProvisionBreakNfcTagCommand,
    controls?: AdminCoordinatorControls,
  ): Promise<ProvisionBreakNfcTagResult>;

  readSetupProjection(
    command: ReadSetupProjectionCommand,
    controls?: AdminCoordinatorControls,
  ): Promise<ReadSetupProjectionResult>;
}

export interface EmployeeMembershipEnrollmentCoordinator {
  createInvitation(
    command: CreateEmployeeMembershipInvitationCommand,
    controls?: EmployeeEnrollmentCoordinatorControls,
  ): Promise<CreateEmployeeMembershipInvitationResult>;

  redeemInvitation(
    command: RedeemEmployeeMembershipInvitationCommand,
    controls?: EmployeeEnrollmentCoordinatorControls,
  ): Promise<RedeemEmployeeMembershipInvitationResult>;

  readEmployeeMembershipsProjection(
    command: ReadEmployeeMembershipsProjectionCommand,
    controls?: EmployeeEnrollmentCoordinatorControls,
  ): Promise<ReadEmployeeMembershipsProjectionResult>;

  revokeMembership(
    command: RevokeMembershipCommand,
    controls?: EmployeeEnrollmentCoordinatorControls,
  ): Promise<MembershipMutationResult>;

  changeMembershipRole(
    command: ChangeMembershipRoleCommand,
    controls?: EmployeeEnrollmentCoordinatorControls,
  ): Promise<MembershipMutationResult>;

  recordPasswordReset(
    command: RecordPasswordResetCommand,
    controls?: EmployeeEnrollmentCoordinatorControls,
  ): Promise<RecordPasswordResetResult>;
}

export interface NfcTagReassignmentPort {
  reassignNfcTag(
    command: ReassignNfcTagCommand,
    controls?: ReassignmentCoordinatorControls,
  ): Promise<ReassignNfcTagResult>;
}

export interface BackendApiDependencies {
  readonly healthCheck?: () => Promise<void>;
  readonly sessionAuthority: SessionAuthorityResolver;
  readonly scanContextResolver: ScanContextResolver;
  readonly lifecycleIngestor: LifecycleIngestor;
  readonly deferredLifecycleIngestor: DeferredLifecycleIngestor;
  readonly offlineCaptureLeaseIssuer: OfflineCaptureLeaseIssuer;
  readonly offlineLifecycleIngestor: OfflineLifecycleIngestor;
  readonly offlineEventReconciliationReader: OfflineEventReconciliationReader;
  readonly administration: AdministrationCoordinator;
  readonly employeeEnrollment: EmployeeMembershipEnrollmentCoordinator;
  readonly tagReassignment: NfcTagReassignmentPort;
  readonly timeEntryExporter: TimeEntryExporter;
  readonly timeReview: TimeReviewPort;
  readonly manualLifecycleIngestor?: ManualLifecycleIngestor;
  readonly mobileWorkReader?: MobileWorkReader;
  readonly projectAdministration?: ProjectAdministrationPort;
}

export type BackendApiRoute =
  | 'health'
  | 'admin_create_customer'
  | 'admin_create_employee_invitation'
  | 'admin_employee_memberships_projection'
  | 'admin_revoke_membership'
  | 'admin_change_membership_role'
  | 'auth_password_reset_audit'
  | 'admin_provision_nfc_tag'
  | 'admin_provision_break_nfc_tag'
  | 'admin_reassign_nfc_tag'
  | 'admin_setup_projection'
  | 'admin_time_entry_export'
  | 'time_entry_export_v2'
  | 'time_entry_export_v3'
  | 'admin_time_record_query'
  | 'admin_time_record_query_v2'
  | 'admin_time_record_correction'
  | 'admin_review_item_query'
  | 'admin_review_item_query_v2'
  | 'admin_review_adjudication'
  | 'admin_project_query'
  | 'admin_project_create'
  | 'admin_project_deactivate'
  | 'deferred_lifecycle'
  | 'employee_enrollment_redeem'
  | 'lifecycle'
  | 'manual_lifecycle'
  | 'manual_break_lifecycle'
  | 'mobile_own_time'
  | 'mobile_work_targets'
  | 'offline_capture_lease'
  | 'offline_capture_lease_page'
  | 'offline_capture_lease_v2'
  | 'offline_capture_lease_page_v2'
  | 'offline_capture_lease_v3'
  | 'offline_capture_lease_page_v3'
  | 'offline_lifecycle'
  | 'offline_lifecycle_v2'
  | 'offline_lifecycle_v3'
  | 'offline_reconciliation'
  | 'offline_review_state'
  | 'scan_context'
  | 'scan_context_v2'
  | 'session';

export interface BackendApiDiagnostic {
  readonly code:
    | 'administration_failed'
    | 'employee_enrollment_failed'
    | 'lifecycle_ingestion_failed'
    | 'offline_synchronization_failed'
    | 'scan_context_resolution_failed'
    | 'session_resolution_failed'
    | 'time_entry_export_failed'
    | 'mobile_work_failed'
    | 'time_review_failed';
  readonly route?: BackendApiRoute;
  readonly correlationId: string;
}

export type BackendApiDiagnosticSink = (diagnostic: BackendApiDiagnostic) => void;

// C1 names remain aliases so its published private regression contract stays source-compatible.
export type SessionApiDiagnostic = BackendApiDiagnostic;
export type SessionApiDiagnosticSink = BackendApiDiagnosticSink;
