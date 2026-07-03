import type { WorkEvent } from '../domain/WorkEvent';
import type { TimeEntry } from '../domain/TimeEntry';
import { TimeEntryId } from '../domain/ids';
import { generateId } from '../domain/generateId';
import { createTimestamp, type Timestamp } from '../domain/Timestamp';
import { timeEntryStarted } from '../domain/events/TimeEntryStarted';
import type { BusinessEngineDecision } from './BusinessEngineDecision';

// DT-005 (partial). Pure decision boundary: state is passed in explicitly
// (activeTimeEntryForTarget), never read from a hidden dependency (EP-008 Ch01 5.8/7.4).
// Only the deterministic branch is implemented; see BusinessEngineDecision for the
// escalation branch and its reason.
export class BusinessEngine {
  constructor(
    private readonly newTimeEntryId: () => TimeEntryId = () => TimeEntryId(generateId()),
    private readonly now: () => Timestamp = () => createTimestamp(new Date().toISOString()),
  ) {}

  evaluate(workEvent: WorkEvent, activeTimeEntryForTarget: TimeEntry | null): BusinessEngineDecision {
    if (activeTimeEntryForTarget !== null) {
      return { status: 'escalation_required', reason: 'duplicate_scan_rule_undefined', workEvent };
    }

    const timeEntry: TimeEntry = {
      id: this.newTimeEntryId(),
      workEventId: workEvent.id,
      organizationId: workEvent.organizationId,
      target: workEvent.target,
      status: 'started',
      startedAt: this.now(),
    };

    return { status: 'time_entry_started', timeEntry, event: timeEntryStarted(timeEntry) };
  }
}
