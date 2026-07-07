import type { TimeEntryRepository } from '../../ports/TimeEntryRepository';
import type { TimeEntry } from '../../domain/TimeEntry';
import type { AssignmentTarget } from '../../domain/AssignmentTarget';
import type { OrganizationId } from '../../domain/ids';
import { readJsonArray, writeJsonArray } from './JsonFileStore';

// DT-015. Durable, file-based TimeEntryRepository adapter - matches
// InMemoryTimeEntryRepository's exact behavior/semantics, but survives process restart.
export class FileTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly filePath: string) {}

  findActiveByTarget(organizationId: OrganizationId, target: AssignmentTarget): TimeEntry | null {
    return (
      this.findAll().find(
        (entry) =>
          entry.organizationId === organizationId &&
          entry.target.targetType === target.targetType &&
          entry.target.targetId === target.targetId &&
          entry.status === 'started',
      ) ?? null
    );
  }

  save(timeEntry: TimeEntry): void {
    const timeEntries = readJsonArray<TimeEntry>(this.filePath);
    timeEntries.push(timeEntry);
    writeJsonArray(this.filePath, timeEntries);
  }

  findAll(): readonly TimeEntry[] {
    return readJsonArray<TimeEntry>(this.filePath);
  }
}
