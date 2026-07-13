import type { TimeEntryRepository } from '../../ports/TimeEntryRepository';
import type { StartedTimeEntry, TimeEntry } from '../../domain/TimeEntry';
import type { OrganizationId, UserId } from '../../domain/ids';
import { readJsonArray, writeJsonArray } from './JsonFileStore';

// DT-015. Durable, file-based TimeEntryRepository adapter - matches
// InMemoryTimeEntryRepository's exact behavior/semantics, but survives process restart.
export class FileTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly filePath: string) {}

  async findActiveByUser(organizationId: OrganizationId, userId: UserId): Promise<StartedTimeEntry | null> {
    return (
      this.readAll().find(
        (entry): entry is StartedTimeEntry =>
          entry.organizationId === organizationId && entry.userId === userId && entry.status === 'started',
      ) ?? null
    );
  }

  async save(timeEntry: TimeEntry): Promise<void> {
    const timeEntries = readJsonArray<TimeEntry>(this.filePath);
    timeEntries.push(timeEntry);
    writeJsonArray(this.filePath, timeEntries);
  }

  async update(timeEntry: TimeEntry): Promise<void> {
    const timeEntries = readJsonArray<TimeEntry>(this.filePath);
    const index = timeEntries.findIndex((existing) => existing.id === timeEntry.id);
    if (index === -1) {
      throw new Error(`Cannot update unknown TimeEntry: ${timeEntry.id}`);
    }

    timeEntries[index] = timeEntry;
    writeJsonArray(this.filePath, timeEntries);
  }

  async findAll(): Promise<readonly TimeEntry[]> {
    return this.readAll();
  }

  private readAll(): TimeEntry[] {
    return readJsonArray<TimeEntry>(this.filePath);
  }
}
