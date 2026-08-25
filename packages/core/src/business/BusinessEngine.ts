import type { WorkEvent } from '../domain/WorkEvent';
import { isBreakWorkEvent, workEventSubjectType, workEventTriggerType } from '../domain/WorkEvent';
import type { StartedTimeEntry, StoppedTimeEntry } from '../domain/TimeEntry';
import type { StartedBreakInterval, StoppedBreakInterval } from '../domain/BreakInterval';
import type { AssignmentTarget } from '../domain/AssignmentTarget';
import { BreakIntervalId, TimeEntryId } from '../domain/ids';
import { generateId } from '../domain/generateId';
import { duplicateScanIgnored } from '../domain/events/DuplicateScanIgnored';
import { timeEntryStarted } from '../domain/events/TimeEntryStarted';
import { timeEntryStopped } from '../domain/events/TimeEntryStopped';
import { breakIntervalStarted } from '../domain/events/BreakIntervalStarted';
import { breakIntervalStopped } from '../domain/events/BreakIntervalStopped';
import type { BusinessEngineDecision, BusinessEngineEscalationReason } from './BusinessEngineDecision';

export interface BusinessEngineEvaluationContext {
  readonly activeTimeEntryForUser: StartedTimeEntry | null;
  readonly activeBreakIntervalForUser?: StartedBreakInterval | null;
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
  constructor(
    private readonly newTimeEntryId: () => TimeEntryId = () => TimeEntryId(generateId()),
    private readonly newBreakIntervalId: () => BreakIntervalId = () => BreakIntervalId(generateId()),
  ) {}

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
    const activeBreakInterval = context.activeBreakIntervalForUser ?? null;
    if (isBreakWorkEvent(workEvent)) {
      if (activeTimeEntry === null) {
        return { status: 'break_without_active_time_entry_rejected', workEvent };
      }
      if (activeBreakInterval !== null) {
        const stoppedBreakInterval: StoppedBreakInterval = {
          ...activeBreakInterval,
          status: 'stopped',
          stoppedAt: workEvent.occurredAt,
          stoppedByWorkEventId: workEvent.id,
          stoppedVia: workEventTriggerType(workEvent),
        };
        return {
          status: 'break_stopped',
          timeEntry: activeTimeEntry,
          breakInterval: stoppedBreakInterval,
          event: breakIntervalStopped(stoppedBreakInterval),
        };
      }
      const startedBreakInterval: StartedBreakInterval = {
        id: this.newBreakIntervalId(),
        organizationId: workEvent.organizationId,
        userId: workEvent.triggeredBy,
        timeEntryId: activeTimeEntry.id,
        status: 'started',
        startedAt: workEvent.occurredAt,
        startedByWorkEventId: workEvent.id,
        startedVia: workEventTriggerType(workEvent),
      };
      return {
        status: 'break_started',
        timeEntry: activeTimeEntry,
        breakInterval: startedBreakInterval,
        event: breakIntervalStarted(startedBreakInterval),
      };
    }

    if (activeTimeEntry !== null && activeBreakInterval !== null) {
      return {
        status: 'work_trigger_during_break_rejected',
        workEvent,
        activeTimeEntry,
        activeBreakInterval,
      };
    }

    if (activeTimeEntry !== null) {
      if (targetsAreEqual(activeTimeEntry.target, workEvent.target)) {
        const stoppedTimeEntry: StoppedTimeEntry = {
          ...activeTimeEntry,
          status: 'stopped',
          stoppedAt: workEvent.occurredAt,
          stoppedByWorkEventId: workEvent.id,
          stoppedVia: workEventTriggerType(workEvent),
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
      startedVia: workEventTriggerType(workEvent),
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

    const activeBreakInterval = context.activeBreakIntervalForUser ?? null;
    if (activeBreakInterval !== null) {
      if (activeBreakInterval.organizationId !== workEvent.organizationId) {
        return 'active_break_organization_mismatch';
      }
      if (activeBreakInterval.userId !== workEvent.triggeredBy) {
        return 'active_break_user_mismatch';
      }
      if (activeTimeEntry === null || activeBreakInterval.timeEntryId !== activeTimeEntry.id) {
        return 'active_break_time_entry_mismatch';
      }
      if (milliseconds(workEvent.occurredAt) < milliseconds(activeBreakInterval.startedAt)) {
        return 'work_event_precedes_active_break';
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
      if (workEventSubjectType(previousWorkEvent) !== workEventSubjectType(workEvent)) {
        return 'previous_work_event_subject_mismatch';
      }
      if (
        !isBreakWorkEvent(previousWorkEvent)
        && !isBreakWorkEvent(workEvent)
        && !targetsAreEqual(previousWorkEvent.target, workEvent.target)
      ) {
        return 'previous_work_event_target_mismatch';
      }
      if (milliseconds(workEvent.occurredAt) < milliseconds(previousWorkEvent.occurredAt)) {
        return 'work_event_precedes_previous_accepted_work_event';
      }
    }

    return null;
  }
}
