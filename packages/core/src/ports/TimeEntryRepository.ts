import type { StartedTimeEntry, TimeEntry } from '../domain/TimeEntry';
import type { AssignmentTarget } from '../domain/AssignmentTarget';
import type { OrganizationId, UserId } from '../domain/ids';

export interface TimeEntryRepository {
  findActiveByTarget(organizationId: OrganizationId, target: AssignmentTarget): StartedTimeEntry | null;
  findActiveByUser(organizationId: OrganizationId, userId: UserId): StartedTimeEntry | null;
  save(timeEntry: TimeEntry): void;
  update(timeEntry: TimeEntry): void;
}
