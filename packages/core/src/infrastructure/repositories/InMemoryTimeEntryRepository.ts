import type { TimeEntryRepository } from '../../ports/TimeEntryRepository';
import type { StartedTimeEntry, TimeEntry } from '../../domain/TimeEntry';
import type { OrganizationId, UserId } from '../../domain/ids';

export class InMemoryTimeEntryRepository implements TimeEntryRepository {
  private readonly timeEntries: TimeEntry[] = [];

  async findActiveByUser(organizationId: OrganizationId, userId: UserId): Promise<StartedTimeEntry | null> {
    return (
      this.timeEntries.find(
        (entry): entry is StartedTimeEntry =>
          entry.organizationId === organizationId && entry.userId === userId && entry.status === 'started',
      ) ?? null
    );
  }

  async save(timeEntry: TimeEntry): Promise<void> {
    this.timeEntries.push(timeEntry);
  }

  async update(timeEntry: TimeEntry): Promise<void> {
    const index = this.timeEntries.findIndex((existing) => existing.id === timeEntry.id);
    if (index === -1) {
      throw new Error(`Cannot update unknown TimeEntry: ${timeEntry.id}`);
    }

    this.timeEntries[index] = timeEntry;
  }

  async findAll(): Promise<readonly TimeEntry[]> {
    return this.timeEntries;
  }
}
