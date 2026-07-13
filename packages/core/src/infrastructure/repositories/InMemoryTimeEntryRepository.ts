import type { TimeEntryRepository } from '../../ports/TimeEntryRepository';
import type { StartedTimeEntry, TimeEntry } from '../../domain/TimeEntry';
import type { OrganizationId, UserId } from '../../domain/ids';

export class InMemoryTimeEntryRepository implements TimeEntryRepository {
  private readonly timeEntries: TimeEntry[] = [];

  findActiveByUser(organizationId: OrganizationId, userId: UserId): StartedTimeEntry | null {
    return (
      this.timeEntries.find(
        (entry): entry is StartedTimeEntry =>
          entry.organizationId === organizationId && entry.userId === userId && entry.status === 'started',
      ) ?? null
    );
  }

  save(timeEntry: TimeEntry): void {
    this.timeEntries.push(timeEntry);
  }

  update(timeEntry: TimeEntry): void {
    const index = this.timeEntries.findIndex((existing) => existing.id === timeEntry.id);
    if (index === -1) {
      throw new Error(`Cannot update unknown TimeEntry: ${timeEntry.id}`);
    }

    this.timeEntries[index] = timeEntry;
  }

  findAll(): readonly TimeEntry[] {
    return this.timeEntries;
  }
}
