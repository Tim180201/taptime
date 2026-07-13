import type { StartedTimeEntry } from '../domain/TimeEntry';
import type { WorkEvent } from '../domain/WorkEvent';
import type { TimeEntryStarted } from '../domain/events/TimeEntryStarted';

// The "active TimeEntry already exists" branch intentionally remains an escalation in this
// domain-foundation task. The approved F-01 stop/duplicate/other-target decisions are implemented
// only in their dedicated follow-up scope.
export type BusinessEngineDecision =
  | { readonly status: 'time_entry_started'; readonly timeEntry: StartedTimeEntry; readonly event: TimeEntryStarted }
  | { readonly status: 'escalation_required'; readonly reason: 'duplicate_scan_rule_undefined'; readonly workEvent: WorkEvent };
