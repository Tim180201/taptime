import type {
  OfflineCaptureLeaseIssueCommand,
  OfflineCaptureLeasePageCommand,
  OfflineCaptureLeaseResult,
  OfflineCaptureLeaseResultV2,
  OfflineCaptureLeaseResultV3,
  OfflineLifecycleEventCommand,
  OfflineLifecycleEventCommandV2,
  OfflineLifecycleEventCommandV3,
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
  readonly command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2 | OfflineLifecycleEventCommandV3;
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
  readonly issueV2?: (
    command: AuthenticatedOfflineCaptureLeaseIssueCommand,
  ) => Promise<OfflineCaptureLeaseResultV2>;
  readonly readPageV2?: (
    command: AuthenticatedOfflineCaptureLeasePageCommand,
  ) => Promise<OfflineCaptureLeaseResultV2>;
  readonly issueV3?: (
    command: AuthenticatedOfflineCaptureLeaseIssueCommand,
  ) => Promise<OfflineCaptureLeaseResultV3>;
  readonly readPageV3?: (
    command: AuthenticatedOfflineCaptureLeasePageCommand,
  ) => Promise<OfflineCaptureLeaseResultV3>;
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
