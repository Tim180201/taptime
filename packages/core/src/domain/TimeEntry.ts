import type { OrganizationId, TimeEntryId, UserId, WorkEventId } from './ids';
import type { AssignmentTarget } from './AssignmentTarget';
import type { Timestamp } from './Timestamp';
import type { WorkEventTriggerType } from './WorkEvent';

// TTAP-001 Aggregate Root. The lifecycle states preserve the WorkEvents that started and,
// when completed, stopped the entry. Duration remains derived from the two timestamps.
interface TimeEntryBase {
  readonly id: TimeEntryId;
  readonly workEventId: WorkEventId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly target: AssignmentTarget;
  readonly startedAt: Timestamp;
  /** Additive DA5 provenance; absent means legacy NFC and remains source-compatible. */
  readonly startedVia?: WorkEventTriggerType;
}

export interface StartedTimeEntry extends TimeEntryBase {
  readonly status: 'started';
}

export interface StoppedTimeEntry extends TimeEntryBase {
  readonly status: 'stopped';
  readonly stoppedAt: Timestamp;
  readonly stoppedByWorkEventId: WorkEventId;
  /** Additive DA5 provenance; absent means legacy NFC and remains source-compatible. */
  readonly stoppedVia?: WorkEventTriggerType;
}

export type TimeEntry = StartedTimeEntry | StoppedTimeEntry;
