import type { WorkEventRepository } from '../../ports/WorkEventRepository';
import type { WorkEvent } from '../../domain/WorkEvent';
import type { AssignmentTarget } from '../../domain/AssignmentTarget';
import type { OrganizationId, UserId } from '../../domain/ids';
import { readJsonArray, writeJsonArray } from './JsonFileStore';

// DT-015. Durable, file-based WorkEventRepository adapter - matches
// InMemoryWorkEventRepository's exact behavior/semantics, but survives process restart.
export class FileWorkEventRepository implements WorkEventRepository {
  constructor(private readonly filePath: string) {}

  findLatestByUserAndTarget(
    organizationId: OrganizationId,
    userId: UserId,
    target: AssignmentTarget,
  ): WorkEvent | null {
    return this.findAll().reduce<WorkEvent | null>((latest, workEvent) => {
      const matches =
        workEvent.organizationId === organizationId &&
        workEvent.triggeredBy === userId &&
        workEvent.target.targetType === target.targetType &&
        workEvent.target.targetId === target.targetId;
      if (!matches) {
        return latest;
      }

      return latest === null || new Date(workEvent.occurredAt).getTime() >= new Date(latest.occurredAt).getTime()
        ? workEvent
        : latest;
    }, null);
  }

  save(workEvent: WorkEvent): void {
    const workEvents = readJsonArray<WorkEvent>(this.filePath);
    workEvents.push(workEvent);
    writeJsonArray(this.filePath, workEvents);
  }

  findAll(): readonly WorkEvent[] {
    return readJsonArray<WorkEvent>(this.filePath);
  }
}
