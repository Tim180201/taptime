import type { OrganizationId, TimeEntryId, WorkEventId } from './ids';
import type { AssignmentTarget } from './AssignmentTarget';
import type { Timestamp } from './Timestamp';

// TTAP-001 Aggregate Root. Only the 'started' status is implemented this sprint (Development
// Sprint 002 Plan, Section 4/6); 'stopped'/'pending' depend on Finding F-01 and are not modeled
// yet to avoid guessing an undefined business rule.
export interface TimeEntry {
  readonly id: TimeEntryId;
  readonly workEventId: WorkEventId;
  readonly organizationId: OrganizationId;
  readonly target: AssignmentTarget;
  readonly status: 'started';
  readonly startedAt: Timestamp;
}
