import type { StartedTimeEntry, StoppedTimeEntry } from '../domain/TimeEntry';
import type { WorkEvent } from '../domain/WorkEvent';
import type { DuplicateScanIgnored } from '../domain/events/DuplicateScanIgnored';
import type { TimeEntryStarted } from '../domain/events/TimeEntryStarted';
import type { TimeEntryStopped } from '../domain/events/TimeEntryStopped';

export type BusinessEngineEscalationReason =
  | 'active_time_entry_organization_mismatch'
  | 'active_time_entry_user_mismatch'
  | 'previous_work_event_organization_mismatch'
  | 'previous_work_event_user_mismatch'
  | 'previous_work_event_target_mismatch'
  | 'work_event_precedes_active_time_entry'
  | 'work_event_precedes_previous_accepted_work_event';

export type BusinessEngineDecision =
  | { readonly status: 'time_entry_started'; readonly timeEntry: StartedTimeEntry; readonly event: TimeEntryStarted }
  | { readonly status: 'time_entry_stopped'; readonly timeEntry: StoppedTimeEntry; readonly event: TimeEntryStopped }
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
      readonly status: 'escalation_required';
      readonly reason: BusinessEngineEscalationReason;
      readonly workEvent: WorkEvent;
    };
