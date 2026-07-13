import type { StartedTimeEntry, TimeEntry } from '../domain/TimeEntry';
import type { AssignmentTarget } from '../domain/AssignmentTarget';
import type { OrganizationId } from '../domain/ids';

export interface TimeEntryRepository {
  findActiveByTarget(organizationId: OrganizationId, target: AssignmentTarget): StartedTimeEntry | null;
  save(timeEntry: TimeEntry): void;
}
