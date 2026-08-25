import type { StartedTimeEntry, StoppedTimeEntry } from '../domain/TimeEntry';
import type { WorkEvent } from '../domain/WorkEvent';
import type { DuplicateScanIgnored } from '../domain/events/DuplicateScanIgnored';
import type { TimeEntryStarted } from '../domain/events/TimeEntryStarted';
import type { TimeEntryStopped } from '../domain/events/TimeEntryStopped';
import type { StartedBreakInterval, StoppedBreakInterval } from '../domain/BreakInterval';
import type { BreakIntervalStarted } from '../domain/events/BreakIntervalStarted';
import type { BreakIntervalStopped } from '../domain/events/BreakIntervalStopped';

export type BusinessEngineEscalationReason =
  | 'active_time_entry_organization_mismatch'
  | 'active_time_entry_user_mismatch'
  | 'previous_work_event_organization_mismatch'
  | 'previous_work_event_user_mismatch'
  | 'previous_work_event_target_mismatch'
  | 'previous_work_event_subject_mismatch'
  | 'active_break_organization_mismatch'
  | 'active_break_user_mismatch'
  | 'active_break_time_entry_mismatch'
  | 'work_event_precedes_active_break'
  | 'work_event_precedes_active_time_entry'
  | 'work_event_precedes_previous_accepted_work_event';

export type BusinessEngineDecision =
  | { readonly status: 'time_entry_started'; readonly timeEntry: StartedTimeEntry; readonly event: TimeEntryStarted }
  | { readonly status: 'time_entry_stopped'; readonly timeEntry: StoppedTimeEntry; readonly event: TimeEntryStopped }
  | {
      readonly status: 'break_started';
      readonly timeEntry: StartedTimeEntry;
      readonly breakInterval: StartedBreakInterval;
      readonly event: BreakIntervalStarted;
    }
  | {
      readonly status: 'break_stopped';
      readonly timeEntry: StartedTimeEntry;
      readonly breakInterval: StoppedBreakInterval;
      readonly event: BreakIntervalStopped;
    }
  | {
      readonly status: 'duplicate_scan_ignored';
      readonly workEvent: WorkEvent;
      readonly previousWorkEvent: WorkEvent;
      readonly event: DuplicateScanIgnored;
    }
  | {
      readonly status: 'active_entry_for_other_target_rejected';
      readonly workEvent: WorkEvent;
      readonly activeTimeEntry: StartedTimeEntry;
    }
  | {
      readonly status: 'break_without_active_time_entry_rejected';
      readonly workEvent: WorkEvent;
    }
  | {
      readonly status: 'work_trigger_during_break_rejected';
      readonly workEvent: WorkEvent;
      readonly activeTimeEntry: StartedTimeEntry;
      readonly activeBreakInterval: StartedBreakInterval;
    }
  | {
      readonly status: 'escalation_required';
      readonly reason: BusinessEngineEscalationReason;
      readonly workEvent: WorkEvent;
    };
