import type {
  OfflineCaptureLeaseIssueCommand,
  OfflineCaptureLeasePageCommand,
  OfflineCaptureLeaseResult,
  OfflineLifecycleEventCommand,
  OfflineLifecycleEventResult,
  OfflineReconciliationCommand,
  OfflineReconciliationResult,
} from '@taptime/offline-sync-contract';
import type {
  MobileReviewState,
  MobileReviewStateRequest,
  TimeReviewReadResult,
} from '@taptime/time-review-contract';

export interface AuthenticatedOfflineCaptureLeaseIssueCommand {
  readonly accessToken: string;
  readonly command: OfflineCaptureLeaseIssueCommand;
}

export interface AuthenticatedOfflineCaptureLeasePageCommand {
  readonly accessToken: string;
  readonly command: OfflineCaptureLeasePageCommand;
}

export interface AuthenticatedOfflineLifecycleEventCommand {
  readonly accessToken: string;
  readonly command: OfflineLifecycleEventCommand;
}

/** Test/evidence controls only; no actor, role, database handle, or query surface is exposed. */
export interface OfflineLifecycleIngestionControls {
  readonly afterAuthorityLocked?: () => void | Promise<void>;
}

export interface AuthenticatedOfflineReconciliationCommand {
  readonly accessToken: string;
  readonly command: OfflineReconciliationCommand;
}

export interface AuthenticatedMobileReviewStateCommand {
  readonly accessToken: string;
  readonly request: MobileReviewStateRequest;
}

export interface OfflineCaptureLeaseIssuer {
  issue(
    command: AuthenticatedOfflineCaptureLeaseIssueCommand,
  ): Promise<OfflineCaptureLeaseResult>;
  readPage(
    command: AuthenticatedOfflineCaptureLeasePageCommand,
  ): Promise<OfflineCaptureLeaseResult>;
}

export interface OfflineLifecycleIngestor {
  ingest(
    command: AuthenticatedOfflineLifecycleEventCommand,
    controls?: OfflineLifecycleIngestionControls,
  ): Promise<OfflineLifecycleEventResult>;
}

export interface OfflineEventReconciliationReader {
  reconcile(
    command: AuthenticatedOfflineReconciliationCommand,
  ): Promise<OfflineReconciliationResult>;
  readReviewState(
    command: AuthenticatedMobileReviewStateCommand,
  ): Promise<TimeReviewReadResult<MobileReviewState>>;
}
