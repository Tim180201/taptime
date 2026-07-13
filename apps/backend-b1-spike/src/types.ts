import type {
  BusinessEngineDecision,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  TimeEntryId,
  Timestamp,
  UserId,
  WorkEventId,
} from '@taptime/core';
import type { AssignmentTarget } from '@taptime/core';

export interface B1RequestContext {
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
}

export interface B1WorkEventSubmission {
  readonly id: WorkEventId;
  readonly assignmentId: NfcAssignmentId;
  readonly nfcTagId: NfcTagId;
  readonly target: AssignmentTarget;
  readonly occurredAt: Timestamp;
}

export interface B1LifecycleRequest {
  readonly requestId: string;
  readonly context: B1RequestContext;
  readonly workEvent: B1WorkEventSubmission;
  readonly localTimeEntryId?: string;
}

export type B1WriteStage =
  | 'work_event'
  | 'time_entry'
  | 'work_event_decision'
  | 'sync_receipt'
  | 'audit_event';

export interface B1LifecycleControls {
  readonly failAfter?: B1WriteStage;
  readonly afterLockAcquired?: () => Promise<void> | void;
  readonly afterWrite?: (stage: B1WriteStage) => Promise<void> | void;
}

export interface B1LifecycleResult {
  readonly decisionStatus: BusinessEngineDecision['status'];
  readonly escalationReason: string | null;
  readonly serverTimeEntryId: TimeEntryId | null;
  readonly idempotentRetry: boolean;
}

export interface B1TableCounts {
  readonly workEvents: number;
  readonly workEventDecisions: number;
  readonly timeEntries: number;
  readonly syncReceipts: number;
  readonly auditEvents: number;
}
