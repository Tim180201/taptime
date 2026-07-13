import type { WorkEvent } from '../domain/WorkEvent';
import type { StartedTimeEntry, StoppedTimeEntry } from '../domain/TimeEntry';
import type { AssignmentTarget } from '../domain/AssignmentTarget';
import { TimeEntryId } from '../domain/ids';
import { generateId } from '../domain/generateId';
import { duplicateScanIgnored } from '../domain/events/DuplicateScanIgnored';
import { timeEntryStarted } from '../domain/events/TimeEntryStarted';
import { timeEntryStopped } from '../domain/events/TimeEntryStopped';
import type { BusinessEngineDecision, BusinessEngineEscalationReason } from './BusinessEngineDecision';

export interface BusinessEngineEvaluationContext {
  readonly activeTimeEntryForUser: StartedTimeEntry | null;
  readonly previousAcceptedWorkEventForUserAndTarget: WorkEvent | null;
}

const DUPLICATE_WINDOW_MILLISECONDS = 5_000;

function targetsAreEqual(left: AssignmentTarget, right: AssignmentTarget): boolean {
  return left.targetType === right.targetType && left.targetId === right.targetId;
}

function milliseconds(timestamp: string): number {
  return new Date(timestamp).getTime();
}

// Pure F-01 decision boundary: all required state is passed explicitly. The engine owns the
// decision order and never reads a repository or clock dependency.
export class BusinessEngine {
  constructor(private readonly newTimeEntryId: () => TimeEntryId = () => TimeEntryId(generateId())) {}

  evaluate(workEvent: WorkEvent, context: BusinessEngineEvaluationContext): BusinessEngineDecision {
    const inconsistency = this.findInconsistency(workEvent, context);
    if (inconsistency !== null) {
      return { status: 'escalation_required', reason: inconsistency, workEvent };
    }

    const previousWorkEvent = context.previousAcceptedWorkEventForUserAndTarget;
    if (
      previousWorkEvent !== null &&
      milliseconds(workEvent.occurredAt) - milliseconds(previousWorkEvent.occurredAt) <
        DUPLICATE_WINDOW_MILLISECONDS
    ) {
      return {
        status: 'duplicate_scan_ignored',
        workEvent,
        previousWorkEvent,
        event: duplicateScanIgnored(workEvent, previousWorkEvent),
      };
    }

    const activeTimeEntry = context.activeTimeEntryForUser;
    if (activeTimeEntry !== null) {
      if (targetsAreEqual(activeTimeEntry.target, workEvent.target)) {
        const stoppedTimeEntry: StoppedTimeEntry = {
          ...activeTimeEntry,
          status: 'stopped',
          stoppedAt: workEvent.occurredAt,
          stoppedByWorkEventId: workEvent.id,
        };
        return {
          status: 'time_entry_stopped',
          timeEntry: stoppedTimeEntry,
          event: timeEntryStopped(stoppedTimeEntry),
        };
      }

      return {
        status: 'active_entry_for_other_target_rejected',
        workEvent,
        activeTimeEntry,
      };
    }

    const timeEntry: StartedTimeEntry = {
      id: this.newTimeEntryId(),
      workEventId: workEvent.id,
      organizationId: workEvent.organizationId,
      userId: workEvent.triggeredBy,
      target: workEvent.target,
      status: 'started',
      startedAt: workEvent.occurredAt,
    };

    return { status: 'time_entry_started', timeEntry, event: timeEntryStarted(timeEntry) };
  }

  private findInconsistency(
    workEvent: WorkEvent,
    context: BusinessEngineEvaluationContext,
  ): BusinessEngineEscalationReason | null {
    const activeTimeEntry = context.activeTimeEntryForUser;
    if (activeTimeEntry !== null) {
      if (activeTimeEntry.organizationId !== workEvent.organizationId) {
        return 'active_time_entry_organization_mismatch';
      }
      if (activeTimeEntry.userId !== workEvent.triggeredBy) {
        return 'active_time_entry_user_mismatch';
      }
      if (milliseconds(workEvent.occurredAt) < milliseconds(activeTimeEntry.startedAt)) {
        return 'work_event_precedes_active_time_entry';
      }
    }

    const previousWorkEvent = context.previousAcceptedWorkEventForUserAndTarget;
    if (previousWorkEvent !== null) {
      if (previousWorkEvent.organizationId !== workEvent.organizationId) {
        return 'previous_work_event_organization_mismatch';
      }
      if (previousWorkEvent.triggeredBy !== workEvent.triggeredBy) {
        return 'previous_work_event_user_mismatch';
      }
      if (!targetsAreEqual(previousWorkEvent.target, workEvent.target)) {
        return 'previous_work_event_target_mismatch';
      }
      if (milliseconds(workEvent.occurredAt) < milliseconds(previousWorkEvent.occurredAt)) {
        return 'work_event_precedes_previous_accepted_work_event';
      }
    }

    return null;
  }
}
