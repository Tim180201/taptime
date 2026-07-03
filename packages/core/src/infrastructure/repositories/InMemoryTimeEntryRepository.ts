import type { TimeEntryRepository } from '../../ports/TimeEntryRepository';
import type { TimeEntry } from '../../domain/TimeEntry';
import type { AssignmentTarget } from '../../domain/AssignmentTarget';
import type { OrganizationId } from '../../domain/ids';

export class InMemoryTimeEntryRepository implements TimeEntryRepository {
  private readonly timeEntries: TimeEntry[] = [];

  findActiveByTarget(organizationId: OrganizationId, target: AssignmentTarget): TimeEntry | null {
    return (
      this.timeEntries.find(
        (entry) =>
          entry.organizationId === organizationId &&
          entry.target.targetType === target.targetType &&
          entry.target.targetId === target.targetId &&
          entry.status === 'started',
      ) ?? null
    );
  }

  save(timeEntry: TimeEntry): void {
    this.timeEntries.push(timeEntry);
  }

  findAll(): readonly TimeEntry[] {
    return this.timeEntries;
  }
}
