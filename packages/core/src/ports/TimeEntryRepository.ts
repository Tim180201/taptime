import type { StartedTimeEntry, TimeEntry } from '../domain/TimeEntry';
import type { OrganizationId, UserId } from '../domain/ids';

export interface TimeEntryRepository {
  findActiveByUser(organizationId: OrganizationId, userId: UserId): Promise<StartedTimeEntry | null>;
  save(timeEntry: TimeEntry): Promise<void>;
  update(timeEntry: TimeEntry): Promise<void>;
}
