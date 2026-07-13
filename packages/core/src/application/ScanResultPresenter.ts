import type { ScanPipelineOutcome } from './ScanPipelineOutcome';
import type { AssignmentResolutionRejectionReason } from '../domain/events/NfcAssignmentResolution';
import type { AssignmentValidationRejectionReason } from '../business/AssignmentValidationResult';
import type { DuplicateScanIgnored } from '../domain/events/DuplicateScanIgnored';
import type { WorkEventCreated } from '../domain/events/WorkEventCreated';
import type { TimeEntryStarted } from '../domain/events/TimeEntryStarted';
import type { TimeEntryStopped } from '../domain/events/TimeEntryStopped';
import type { WorkEventQueuedForSync } from '../domain/events/WorkEventQueuedForSync';
import type { WorkEventSynchronized } from '../domain/events/WorkEventSynchronized';
import type { WorkEventSyncFailed } from '../domain/events/WorkEventSyncFailed';
import type { ErrorCategory } from '../domain/ErrorCategory';
import { classifyScanPipelineOutcome } from './classifyScanPipelineOutcome';
import { classifyBusinessEngineDecision } from '../business/classifyBusinessEngineDecision';

export type PresentableEvent =
  | WorkEventCreated
  | TimeEntryStarted
  | TimeEntryStopped
  | DuplicateScanIgnored
  | WorkEventQueuedForSync
  | WorkEventSynchronized
  | WorkEventSyncFailed;

// DT-009. Pairs an existing rendered message with its TTAP-001 error category, without
// changing the message itself - additive to presentScanOutcome()/presentEvent(), never a
// replacement for them.
export interface PresentedOutcome {
  readonly message: string;
  readonly category: ErrorCategory | null;
}

const RESOLUTION_REJECTION_DESCRIPTIONS: Record<AssignmentResolutionRejectionReason, string> = {
  unknown_tag: 'the scanned tag is not known to this organization',
  inactive_assignment: 'the tag has no active assignment',
};

const VALIDATION_REJECTION_DESCRIPTIONS: Record<AssignmentValidationRejectionReason, string> = {
  employee_not_authenticated: 'the employee is not authenticated',
  employee_lacks_organization_access: 'the employee does not have access to this organization',
  missing_assignment_target: 'the assignment target could not be found',
  assignment_target_disabled: 'the assignment target is disabled',
};

// TS-001-named component ("Provide display-ready scan result"), implemented for the first
// time in Development Sprint 005 (DT-011). Renders already-produced outcomes; it never
// decides them (EP-008 Ch03 5.2 - presentation renders capture and outcomes, not business
// meaning). Console/string output only, no UI framework.
export class ScanResultPresenter {
  presentScanOutcome(outcome: ScanPipelineOutcome): string {
    if (outcome.stage === 'capture') {
      return 'Scan rejected: unreadable NFC payload.';
    }

    if (outcome.stage === 'resolution') {
      return `Scan rejected: ${RESOLUTION_REJECTION_DESCRIPTIONS[outcome.reason]}.`;
    }

    if (outcome.result.status === 'rejected') {
      return `Scan rejected: ${VALIDATION_REJECTION_DESCRIPTIONS[outcome.result.reason]}.`;
    }

    return 'Scan accepted: assignment validated, awaiting Business Engine decision.';
  }

  presentEvent(event: PresentableEvent): string {
    switch (event.type) {
      case 'WorkEventCreated':
        return `WorkEvent ${event.workEvent.id} created for organization ${event.workEvent.organizationId}.`;
      case 'TimeEntryStarted':
        return `TimeEntry ${event.timeEntry.id} started.`;
      case 'TimeEntryStopped':
        return `TimeEntry ${event.timeEntry.id} stopped.`;
      case 'DuplicateScanIgnored':
        return `WorkEvent ${event.workEvent.id} ignored as a duplicate of WorkEvent ${event.previousWorkEvent.id}.`;
      case 'WorkEventQueuedForSync':
        return this.presentQueuedForSync(event);
      case 'WorkEventSynchronized':
        return `WorkEvent ${event.record.workEvent.id} synchronized successfully.`;
      case 'WorkEventSyncFailed':
        return event.outcome === 'conflict'
          ? `WorkEvent ${event.record.workEvent.id} has a synchronization conflict: ${event.reason}.`
          : `WorkEvent ${event.record.workEvent.id} synchronization failed (retryable, reason: ${event.reason}).`;
      default:
        return event satisfies never;
    }
  }

  private presentQueuedForSync(event: WorkEventQueuedForSync): string {
    const { decision } = event.record;
    const workEventId = event.record.workEvent.id;

    if (decision === null) {
      return `WorkEvent ${workEventId} queued for synchronization (state: ${event.record.syncState}).`;
    }

    switch (decision.status) {
      case 'time_entry_started':
        return `WorkEvent ${workEventId} accepted and started (TimeEntry ${decision.timeEntry.id}); queued for synchronization.`;
      case 'time_entry_stopped':
        return `WorkEvent ${workEventId} accepted and stopped (TimeEntry ${decision.timeEntry.id}); queued for synchronization.`;
      case 'duplicate_scan_ignored':
        return `WorkEvent ${workEventId} accepted but ignored as a duplicate of WorkEvent ${decision.previousWorkEvent.id}; queued for synchronization.`;
      case 'active_entry_for_other_target_rejected':
        return `WorkEvent ${workEventId} rejected: TimeEntry ${decision.activeTimeEntry.id} is active for another target; queued for synchronization.`;
      case 'escalation_required':
        return `WorkEvent ${workEventId} escalated due to inconsistent state (${decision.reason}); queued for synchronization.`;
      default:
        return decision satisfies never;
    }
  }

  // DT-009. Additive: pairs presentScanOutcome()'s exact, unchanged message with its
  // TTAP-001 error category.
  presentScanOutcomeWithCategory(outcome: ScanPipelineOutcome): PresentedOutcome {
    return { message: this.presentScanOutcome(outcome), category: classifyScanPipelineOutcome(outcome) };
  }

  // DT-009. Additive: pairs presentEvent()'s exact, unchanged message with its TTAP-001
  // error category.
  presentEventWithCategory(event: PresentableEvent): PresentedOutcome {
    return { message: this.presentEvent(event), category: this.classifyEvent(event) };
  }

  private classifyEvent(event: PresentableEvent): ErrorCategory | null {
    switch (event.type) {
      case 'WorkEventCreated':
      case 'TimeEntryStarted':
      case 'TimeEntryStopped':
      case 'DuplicateScanIgnored':
      case 'WorkEventSynchronized':
        return null;
      case 'WorkEventQueuedForSync':
        return event.record.decision === null ? null : classifyBusinessEngineDecision(event.record.decision);
      case 'WorkEventSyncFailed':
        return event.outcome === 'conflict' ? 'conflict' : 'retryable';
      default:
        return event satisfies never;
    }
  }
}
