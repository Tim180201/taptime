import type { TimeEntry } from '../domain/TimeEntry';
import type { WorkEvent } from '../domain/WorkEvent';
import type { TimeEntryStarted } from '../domain/events/TimeEntryStarted';

// The "active TimeEntry already exists" branch is intentionally not a stop/duplicate/defer
// decision. It is an explicit escalation because the rule that would decide it (Finding F-01,
// duplicate-scan/toggle mechanism) is not yet defined by repository evidence. This is a
// deliberate placeholder, not a business decision (Development Sprint 002 Plan, Section 8/12).
export type BusinessEngineDecision =
  | { readonly status: 'time_entry_started'; readonly timeEntry: TimeEntry; readonly event: TimeEntryStarted }
  | { readonly status: 'escalation_required'; readonly reason: 'duplicate_scan_rule_undefined'; readonly workEvent: WorkEvent };
