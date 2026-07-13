import type { OrganizationId, TimeEntryId, UserId, WorkEventId } from './ids';
import type { AssignmentTarget } from './AssignmentTarget';
import type { Timestamp } from './Timestamp';

// TTAP-001 Aggregate Root. The lifecycle states preserve the WorkEvents that started and,
// when completed, stopped the entry. Duration remains derived from the two timestamps.
interface TimeEntryBase {
  readonly id: TimeEntryId;
  readonly workEventId: WorkEventId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly target: AssignmentTarget;
  readonly startedAt: Timestamp;
}

export interface StartedTimeEntry extends TimeEntryBase {
  readonly status: 'started';
}

export interface StoppedTimeEntry extends TimeEntryBase {
  readonly status: 'stopped';
  readonly stoppedAt: Timestamp;
  readonly stoppedByWorkEventId: WorkEventId;
}

export type TimeEntry = StartedTimeEntry | StoppedTimeEntry;
