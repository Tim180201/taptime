export type TimeRecordSource = 'canonical' | 'recovered';
export type TimeRecordStatus = 'started' | 'stopped';
export type ReviewItemSource = 'offline_v2' | 'server_legacy';
export type TimeReviewReason =
  | 'identity_or_membership_not_current'
  | 'capture_time_out_of_bounds'
  | 'automatic_window_elapsed'
  | 'historical_configuration_not_valid'
  | 'predecessor_requires_review'
  | 'server_lifecycle_deferred';

export interface TimeRecordQueryRequest {
  readonly expectedMembershipId: string;
  readonly fromInclusive: string;
  readonly toExclusive: string;
  readonly limit: number;
  readonly cursor: string | null;
}

export interface TimeRecordProjection {
  readonly timeRecordId: string;
  readonly employeeMembershipId: string;
  readonly employeeDisplayName: string;
  readonly customerId: string;
  readonly customerDisplayName: string;
  readonly source: TimeRecordSource;
  readonly status: TimeRecordStatus;
  readonly startedAt: string;
  readonly stoppedAt: string | null;
  readonly baseRowVersion: number;
  readonly effectiveRevisionNumber: number;
  readonly overlapsAnotherRecord: boolean;
}

export interface TimeRecordQueryPage {
  readonly records: readonly TimeRecordProjection[];
  readonly nextCursor: string | null;
}

export interface TimeRecordProjectionV2 {
  readonly timeRecordId: string;
  readonly employeeMembershipId: string;
  readonly employeeDisplayName: string;
  readonly targetType: 'customer' | 'project' | 'general_work';
  readonly targetId: string;
  readonly targetDisplayName: string;
  readonly source: TimeRecordSource;
  readonly status: TimeRecordStatus;
  readonly startedVia: 'nfc' | 'manual' | null;
  readonly stoppedVia: 'nfc' | 'manual' | null;
  readonly startedAt: string;
  readonly stoppedAt: string | null;
  readonly baseRowVersion: number;
  readonly effectiveRevisionNumber: number;
  readonly overlapsAnotherRecord: boolean;
}

export interface TimeRecordQueryPageV2 {
  readonly records: readonly TimeRecordProjectionV2[];
  readonly nextCursor: string | null;
}

export interface TimeRecordCorrectionRequest {
  readonly expectedMembershipId: string;
  readonly commandId: string;
  readonly timeRecordId: string;
  readonly expectedBaseRowVersion: number;
  readonly expectedRevisionNumber: number;
  readonly startedAt: string;
  readonly stoppedAt: string;
  readonly reason: string;
}

export interface CorrectedTimeRecord {
  readonly timeRecordId: string;
  readonly revisionNumber: number;
  readonly startedAt: string;
  readonly stoppedAt: string;
  readonly idempotentRetry: boolean;
}

export interface ReviewItemQueryRequest {
  readonly expectedMembershipId: string;
  readonly limit: number;
  readonly cursor: string | null;
}

export interface ReviewItemProjection {
  readonly reviewItemId: string;
  readonly source: ReviewItemSource;
  readonly employeeUserId: string;
  readonly employeeMembershipId: string;
  readonly employeeDisplayName: string;
  readonly customerId: string;
  readonly customerDisplayName: string;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly reviewReason: TimeReviewReason;
  readonly deviceSequence: number | null;
  readonly predecessorBlocked: boolean;
}

export interface ReviewItemQueryPage {
  readonly items: readonly ReviewItemProjection[];
  readonly nextCursor: string | null;
}

export interface ReviewItemProjectionV2 {
  readonly reviewItemId: string;
  readonly source: ReviewItemSource;
  readonly employeeUserId: string;
  readonly employeeMembershipId: string;
  readonly employeeDisplayName: string;
  readonly targetType: 'customer' | 'project' | 'general_work';
  readonly targetId: string;
  readonly targetDisplayName: string;
  readonly triggerType: 'nfc' | 'manual';
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly reviewReason: TimeReviewReason;
  readonly deviceSequence: number | null;
  readonly predecessorBlocked: boolean;
}

export interface ReviewItemQueryPageV2 {
  readonly items: readonly ReviewItemProjectionV2[];
  readonly nextCursor: string | null;
}

export type ReviewAdjudicationResolution =
  | { readonly type: 'no_time_record_change' }
  | {
      readonly type: 'adjust_existing_time_record';
      readonly timeRecordId: string;
      readonly expectedBaseRowVersion: number;
      readonly expectedRevisionNumber: number;
      readonly startedAt: string;
      readonly stoppedAt: string;
    }
  | {
      readonly type: 'create_recovered_time_record';
      readonly startedAt: string;
      readonly stoppedAt: string;
    };

export interface ReviewAdjudicationRequest {
  readonly expectedMembershipId: string;
  readonly commandId: string;
  readonly reviewItemIds: readonly string[];
  readonly resolution: ReviewAdjudicationResolution;
  readonly reason: string;
}

export interface ReviewAdjudicationReceipt {
  readonly commandId: string;
  readonly resolution: ReviewAdjudicationResolution['type'];
  readonly adjudicatedReviewItemIds: readonly string[];
  readonly timeRecordId: string | null;
  readonly revisionNumber: number | null;
  readonly idempotentRetry: boolean;
}

export interface MobileReviewStateRequest {
  readonly expectedMembershipId: string;
  readonly installationId: string;
}

export type MobileReviewState =
  | {
      readonly status: 'review_pending';
      readonly expectedMembershipId: string;
      readonly installationId: string;
      readonly earliestUnresolvedSequence: number;
    }
  | {
      readonly status: 'clear';
      readonly expectedMembershipId: string;
      readonly installationId: string;
      readonly confirmedThroughSequence: number;
    };

export type TimeReviewReadResult<T> =
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'unavailable' };

export type TimeReviewWriteResult<T> =
  | { readonly status: 'committed'; readonly value: T }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'not_adjustable' }
  | { readonly status: 'conflict'; readonly current?: TimeRecordProjection }
  | { readonly status: 'command_id_conflict' }
  | { readonly status: 'invalid_evidence' }
  | { readonly status: 'unavailable' };

export type ValidationResult<T> =
  | { readonly status: 'valid'; readonly request: T }
  | { readonly status: 'invalid_request' };
