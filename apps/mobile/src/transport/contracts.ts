import type {
  AssignmentTarget,
  BusinessEngineEscalationReason,
  MembershipId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  TimeEntryId,
  Timestamp,
  WorkEventId,
} from '@taptime/core';
import type { AdminSetupApiPort } from '../administration/contracts';

export type MobileTransportFailure =
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'transient_failure' }
  | { readonly status: 'unavailable' };

export interface ScanContextResolutionCommand {
  readonly organizationId: OrganizationId;
  readonly payload: string;
}

export type ScanContextResolutionResult =
  | ({
      readonly status: 'resolved';
      readonly assignmentId: NfcAssignmentId;
      readonly nfcTagId: NfcTagId;
    } & (
      | {
          readonly target: AssignmentTarget;
          readonly subject?: { readonly type: 'work'; readonly target: AssignmentTarget };
        }
      | { readonly subject: { readonly type: 'break' }; readonly target?: never }
    ))
  | { readonly status: 'not_resolved' }
  | MobileTransportFailure;

export interface ScanContextApiPort {
  resolve(command: ScanContextResolutionCommand): Promise<ScanContextResolutionResult>;
}

interface LifecycleWorkEventEvidenceBase {
  readonly id: WorkEventId;
  readonly assignmentId: NfcAssignmentId;
  readonly nfcTagId: NfcTagId;
  readonly occurredAt: Timestamp;
}

export type LifecycleWorkEventEvidence = LifecycleWorkEventEvidenceBase & (
  | { readonly subject?: { readonly type: 'work' }; readonly target: AssignmentTarget }
  | { readonly subject: { readonly type: 'break' }; readonly target?: never }
);

export interface LifecycleReceiptEvidence {
  readonly id: string;
  readonly attemptNumber: number;
  readonly clientTimeEntryId?: TimeEntryId;
}

export interface LifecycleEventCommand {
  readonly organizationId: OrganizationId;
  readonly workEvent: LifecycleWorkEventEvidence;
  readonly receipt: LifecycleReceiptEvidence;
}

export type LifecycleSubmissionMode = 'canonical' | 'defer_only';

/**
 * Private transport submission persisted by the Mobile outbox.
 *
 * expectedMembershipId is a compare-only narrowing value. The server still derives every actor,
 * tenant and role from the authenticated identity and current database state.
 */
export interface LifecycleEventSubmission {
  readonly mode: LifecycleSubmissionMode;
  readonly expectedMembershipId: MembershipId;
  readonly command: LifecycleEventCommand;
}

export type ServerLifecycleDecision =
  | {
      readonly status: 'time_entry_started' | 'time_entry_stopped';
      readonly timeEntryId: TimeEntryId;
    }
  | {
      readonly status: 'break_started' | 'break_stopped';
      readonly timeEntryId: TimeEntryId;
      readonly breakIntervalId: string;
    }
  | {
      readonly status: 'duplicate_scan_ignored';
      readonly previousWorkEventId: WorkEventId;
    }
  | {
      readonly status: 'active_entry_for_other_target_rejected';
      readonly activeTimeEntryId: TimeEntryId;
    }
  | { readonly status: 'break_without_active_time_entry_rejected' }
  | {
      readonly status: 'work_trigger_during_break_rejected';
      readonly activeTimeEntryId: TimeEntryId;
      readonly activeBreakIntervalId: string;
    }
  | {
      readonly status: 'escalation_required';
      readonly reason: BusinessEngineEscalationReason;
    };

export type LifecycleEventResult =
  | {
      readonly status: 'synchronized';
      readonly idempotentRetry: boolean;
      readonly decision: ServerLifecycleDecision;
      readonly workEventId: WorkEventId;
      readonly receiptId: string;
      readonly serverTimeEntryId: TimeEntryId | null;
    }
  | {
      readonly status: 'deferred';
      readonly evidenceStored: true;
      readonly idempotentRetry: boolean;
      readonly workEventId: WorkEventId;
      readonly receiptId: string;
    }
  | {
      readonly status: 'deferred';
      readonly evidenceStored: false;
      readonly reason: 'configuration_unavailable_or_inactive';
    }
  | {
      readonly status: 'conflict';
      readonly reason: 'work_event_content_conflict' | 'receipt_metadata_conflict';
    }
  | MobileTransportFailure;

export interface LifecycleEventApiPort {
  ingest(submission: LifecycleEventSubmission): Promise<LifecycleEventResult>;
}

export interface ProductServerTransport {
  readonly scanContext: ScanContextApiPort;
  readonly lifecycle: LifecycleEventApiPort;
  readonly administration: AdminSetupApiPort;
}
