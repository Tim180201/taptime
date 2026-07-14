import type {
  AssignmentTarget,
  BusinessEngineEscalationReason,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  TimeEntryId,
  Timestamp,
  WorkEventId,
} from '@taptime/core';
import type { AccessTokenVerificationRejectionReason } from '@taptime/backend-identity';

export interface LifecycleWorkEventEvidence {
  readonly id: WorkEventId;
  readonly assignmentId: NfcAssignmentId;
  readonly nfcTagId: NfcTagId;
  readonly target: AssignmentTarget;
  readonly occurredAt: Timestamp;
}

export interface LifecycleReceiptEvidence {
  readonly id: string;
  readonly attemptNumber: number;
  readonly clientTimeEntryId?: TimeEntryId;
}

export interface LifecycleIngestionCommand {
  readonly accessToken: string;
  readonly requestedOrganizationId: OrganizationId;
  readonly workEvent: LifecycleWorkEventEvidence;
  readonly receipt: LifecycleReceiptEvidence;
}

export type PersistedLifecycleDecision =
  | {
      readonly status: 'time_entry_started' | 'time_entry_stopped';
      readonly timeEntryId: TimeEntryId;
    }
  | {
      readonly status: 'duplicate_scan_ignored';
      readonly previousWorkEventId: WorkEventId;
    }
  | {
      readonly status: 'active_entry_for_other_target_rejected';
      readonly activeTimeEntryId: TimeEntryId;
    }
  | {
      readonly status: 'escalation_required';
      readonly reason: BusinessEngineEscalationReason;
    };

export type LifecycleIngestionResult =
  | {
      readonly status: 'synchronized';
      readonly idempotentRetry: boolean;
      readonly decision: PersistedLifecycleDecision;
      readonly workEventId: WorkEventId;
      readonly receiptId: string;
      readonly serverTimeEntryId: TimeEntryId | null;
    }
  | DurableDeferredLifecycleIngestionResult
  | NonDurableDeferredLifecycleIngestionResult
  | LifecycleIngestionConflictResult
  | LifecycleIngestionRejectionResult;

export interface DurableDeferredLifecycleIngestionResult {
  readonly status: 'deferred';
  readonly evidenceStored: true;
  readonly idempotentRetry: boolean;
  readonly workEventId: WorkEventId;
  readonly receiptId: string;
}

export interface NonDurableDeferredLifecycleIngestionResult {
  readonly status: 'deferred';
  readonly evidenceStored: false;
  readonly reason: 'configuration_unavailable_or_inactive';
}

export interface LifecycleIngestionConflictResult {
  readonly status: 'conflict';
  readonly reason: 'work_event_content_conflict' | 'receipt_metadata_conflict';
}

export type LifecycleIngestionRejectionResult =
  | {
      readonly status: 'rejected';
      readonly reason: 'access_token_rejected';
      readonly tokenReason: AccessTokenVerificationRejectionReason;
    }
  | {
      readonly status: 'rejected';
      readonly reason: 'identity_or_membership_unavailable';
    }
  | {
      readonly status: 'rejected';
      readonly reason: 'requested_organization_mismatch';
    };

export type DeferredLifecycleIngestionResult =
  | DurableDeferredLifecycleIngestionResult
  | NonDurableDeferredLifecycleIngestionResult
  | LifecycleIngestionConflictResult
  | LifecycleIngestionRejectionResult;

export type B6WriteStage =
  | 'work_event'
  | 'time_entry'
  | 'canonical_decision'
  | 'sync_receipt'
  | 'audit_event';

/** Test/evidence controls only. They expose no actor, role, database handle or query surface. */
export interface LifecycleIngestionControls {
  readonly failAfter?: B6WriteStage;
  readonly afterAuthorityLocked?: () => Promise<void>;
  readonly afterConfigurationLocked?: () => Promise<void>;
  readonly beforeEngineEvaluation?: () => Promise<void>;
  readonly afterWrite?: (stage: B6WriteStage) => Promise<void>;
}
