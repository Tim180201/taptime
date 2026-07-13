import type { TimeEntryRepository } from '../../ports/TimeEntryRepository';
import type { StartedTimeEntry, TimeEntry } from '../../domain/TimeEntry';
import type { OrganizationId, UserId } from '../../domain/ids';
import { readJsonArray, writeJsonArray } from './JsonFileStore';

// DT-015. Durable, file-based TimeEntryRepository adapter - matches
// InMemoryTimeEntryRepository's exact behavior/semantics, but survives process restart.
export class FileTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly filePath: string) {}

  findActiveByUser(organizationId: OrganizationId, userId: UserId): StartedTimeEntry | null {
    return (
      this.findAll().find(
        (entry): entry is StartedTimeEntry =>
          entry.organizationId === organizationId && entry.userId === userId && entry.status === 'started',
      ) ?? null
    );
  }

  save(timeEntry: TimeEntry): void {
    const timeEntries = readJsonArray<TimeEntry>(this.filePath);
    timeEntries.push(timeEntry);
    writeJsonArray(this.filePath, timeEntries);
  }

  update(timeEntry: TimeEntry): void {
    const timeEntries = readJsonArray<TimeEntry>(this.filePath);
    const index = timeEntries.findIndex((existing) => existing.id === timeEntry.id);
    if (index === -1) {
      throw new Error(`Cannot update unknown TimeEntry: ${timeEntry.id}`);
    }

    timeEntries[index] = timeEntry;
    writeJsonArray(this.filePath, timeEntries);
  }

  findAll(): readonly TimeEntry[] {
    return readJsonArray<TimeEntry>(this.filePath);
  }
}
