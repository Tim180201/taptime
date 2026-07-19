import type {
  OfflineCaptureLeaseIssueCommand,
  OfflineCaptureLeasePageCommand,
  OfflineCaptureLeaseResult,
  OfflineLifecycleEventCommand,
  OfflineLifecycleEventResult,
  OfflineReconciliationCommand,
  OfflineReconciliationResult,
} from '@taptime/offline-sync-contract';

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

export interface AuthenticatedOfflineReconciliationCommand {
  readonly accessToken: string;
  readonly command: OfflineReconciliationCommand;
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
  ): Promise<OfflineLifecycleEventResult>;
}

export interface OfflineEventReconciliationReader {
  reconcile(
    command: AuthenticatedOfflineReconciliationCommand,
  ): Promise<OfflineReconciliationResult>;
}
