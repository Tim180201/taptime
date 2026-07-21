import type { TimeEntryExportRequest } from '@taptime/time-entry-export-contract';

export interface TimeEntryExportCommand {
  readonly accessToken: string;
  readonly correlationId: string;
  readonly request: TimeEntryExportRequest;
}

export type TimeEntryExportResult =
  | {
      readonly status: 'succeeded';
      readonly bytes: Uint8Array;
      readonly byteCount: number;
      readonly rowCount: number;
      readonly sha256: string;
      readonly filename: string;
    }
  | { readonly status: 'invalid_request' }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'forbidden' }
  | { readonly status: 'export_limit_exceeded' }
  | { readonly status: 'service_unavailable' };

export interface TimeEntryExportCoordinatorControls {
  readonly deadlineEpochMilliseconds?: number;
  readonly afterAuthorityLocked?: () => Promise<void> | void;
  readonly afterSnapshotRead?: () => Promise<void> | void;
  readonly beforeAudit?: () => Promise<void> | void;
  readonly beforeCommit?: () => Promise<void> | void;
}

export interface TimeEntryExporter {
  exportTimeEntries(
    command: TimeEntryExportCommand,
    controls?: TimeEntryExportCoordinatorControls,
  ): Promise<TimeEntryExportResult>;
}
