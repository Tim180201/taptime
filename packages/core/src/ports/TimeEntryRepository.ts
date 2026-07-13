import type { StartedTimeEntry, TimeEntry } from '../domain/TimeEntry';
import type { OrganizationId, UserId } from '../domain/ids';

export interface TimeEntryRepository {
  findActiveByUser(organizationId: OrganizationId, userId: UserId): StartedTimeEntry | null;
  save(timeEntry: TimeEntry): void;
  update(timeEntry: TimeEntry): void;
}
