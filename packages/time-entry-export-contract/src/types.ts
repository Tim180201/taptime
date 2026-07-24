export interface TimeEntryExportRequest {
  readonly expectedMembershipId: string;
  readonly fromInclusive: string;
  readonly toExclusive: string;
}

export interface ValidatedTimeEntryExportRequest extends TimeEntryExportRequest {
  readonly fromEpochMilliseconds: number;
  readonly toEpochMilliseconds: number;
}

export type TimeEntryExportRequestValidation =
  | { readonly status: 'valid'; readonly request: ValidatedTimeEntryExportRequest }
  | { readonly status: 'invalid_request' };

export type TimeEntryExportStatus = 'started' | 'stopped';

export interface TimeEntryExportRow {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly timeEntryId: string;
  readonly employeeMembershipId: string;
  readonly employeeDisplayName: string;
  readonly customerId: string;
  readonly customerDisplayName: string;
  readonly status: TimeEntryExportStatus;
  readonly startedAtUtc: string;
  readonly stoppedAtUtc: string;
  readonly durationSeconds: string;
}

export interface TimeEntryExportRowV2 {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly timeEntryId: string;
  readonly employeeMembershipId: string;
  readonly employeeDisplayName: string;
  readonly recordSource: 'canonical' | 'recovered';
  readonly targetType: 'customer' | 'project' | 'general_work';
  readonly targetId: string;
  readonly targetDisplayName: string;
  readonly status: TimeEntryExportStatus;
  readonly startedVia: 'nfc' | 'manual' | '';
  readonly stoppedVia: 'nfc' | 'manual' | '';
  readonly startedAtUtc: string;
  readonly stoppedAtUtc: string;
  readonly durationSeconds: string;
}

export interface SerializedTimeEntryExport {
  readonly bytes: Uint8Array;
  readonly byteCount: number;
  readonly rowCount: number;
}
