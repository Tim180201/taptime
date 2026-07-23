export interface SafeProjection {
  readonly organization: { readonly id: string; readonly name: string };
  readonly customers: readonly { readonly id: string; readonly displayName: string; readonly active: boolean }[];
  readonly nfcTags: readonly { readonly id: string; readonly displayName: string; readonly validationFingerprint: string; readonly assignmentState: 'assigned' | 'unassigned'; readonly targetCustomerId: string | null; readonly activeAssignmentId: string | null }[];
  readonly nextCursor: string | null;
}
export interface SafeEmployeeProjection {
  readonly organization: { readonly id: string; readonly name: string };
  readonly employeeMemberships: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly role: 'employee';
    readonly active: true;
  }[];
  readonly nextCursor: string | null;
}
export interface VolatileInvitationSecret {
  readonly value: string;
  readonly expiresAt: string;
}
export interface ReassignmentIntent {
  readonly commandId: string;
  readonly nfcTagId: string;
  readonly expectedActiveAssignmentId: string;
  readonly targetCustomerId: string;
}
export interface SafeTimeRecord {
  readonly timeRecordId: string;
  readonly employeeDisplayName: string;
  readonly customerDisplayName: string;
  readonly source: 'canonical' | 'recovered';
  readonly status: 'started' | 'stopped';
  readonly startedAt: string;
  readonly stoppedAt: string | null;
  readonly baseRowVersion: number;
  readonly effectiveRevisionNumber: number;
  readonly overlapsAnotherRecord: boolean;
}
export interface SafeReviewItem {
  readonly reviewItemId: string;
  readonly source: 'offline_v2' | 'server_legacy';
  readonly employeeDisplayName: string;
  readonly customerDisplayName: string;
  readonly occurredAt: string;
  readonly reviewReason: string;
  readonly deviceSequence: number | null;
  readonly predecessorBlocked: boolean;
}
export interface CursorPage<Value> {
  readonly items: readonly Value[];
  readonly nextCursor: string | null;
}
export type AdminSection = 'setup' | 'employees' | 'timeRecords' | 'reviewItems';
export type SectionStatus =
  | { readonly status: 'ready' }
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable'; readonly message: string };
export interface TimeCorrectionIntent {
  readonly commandId: string;
  readonly timeRecord: SafeTimeRecord;
  readonly startedAt: string;
  readonly stoppedAt: string;
  readonly reason: string;
}
export interface ReviewAdjudicationIntent {
  readonly commandId: string;
  readonly reviewItem: SafeReviewItem;
  readonly resolution: 'no_time_record_change' | 'adjust_existing_time_record'
    | 'create_recovered_time_record';
  readonly timeRecord: SafeTimeRecord | null;
  readonly startedAt: string | null;
  readonly stoppedAt: string | null;
  readonly reason: string;
}
export type AdminWebState =
  | { readonly status: 'signed_out' }
  | { readonly status: 'signing_in' }
  | { readonly status: 'loading' }
  | { readonly status: 'forbidden'; readonly message: string }
  | { readonly status: 'unavailable'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly projection: SafeProjection;
      readonly employeeProjection: SafeEmployeeProjection;
      readonly creating: boolean;
      readonly creatingEmployee: boolean;
      readonly invitation: VolatileInvitationSecret | null;
      readonly reassignmentIntent: ReassignmentIntent | null;
      readonly reassigning: boolean;
      readonly timeRecords: readonly SafeTimeRecord[];
      readonly timeRecordsNextCursor: string | null;
      readonly reviewItems: readonly SafeReviewItem[];
      readonly reviewItemsNextCursor: string | null;
      readonly sections: Readonly<Record<AdminSection, SectionStatus>>;
      readonly timeWindow: { readonly fromInclusive: string; readonly toExclusive: string };
      readonly timeReviewBusy: boolean;
      readonly correctionIntent: TimeCorrectionIntent | null;
      readonly adjudicationIntent: ReviewAdjudicationIntent | null;
      readonly notice: string | null;
    };
export interface AdminWebCapability {
  getState(): AdminWebState;
  subscribe(listener: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  retrySection(section: AdminSection): Promise<void>;
  loadMore(): Promise<void>;
  createCustomer(displayName: string): Promise<void>;
  createEmployeeInvitation(displayName: string): Promise<void>;
  loadMoreEmployees(): Promise<void>;
  dismissInvitation(): void;
  prepareReassignment(nfcTagId: string, targetCustomerId: string): void;
  cancelReassignment(): void;
  confirmReassignment(): Promise<void>;
  prepareCorrection(timeRecordId: string, startedAt: string, stoppedAt: string, reason: string): void;
  cancelCorrection(): void;
  confirmCorrection(): Promise<void>;
  prepareAdjudication(
    reviewItemId: string,
    resolution: ReviewAdjudicationIntent['resolution'],
    timeRecordId: string | null,
    startedAt: string | null,
    stoppedAt: string | null,
    reason: string,
  ): void;
  cancelAdjudication(): void;
  confirmAdjudication(): Promise<void>;
  exportTimeRecords(): Promise<void>;
  loadMoreTimeRecords(): Promise<void>;
  loadMoreReviewItems(): Promise<void>;
}
