import type { WorkEventRepository } from '../../ports/WorkEventRepository';
import type { WorkEvent } from '../../domain/WorkEvent';
import type { AssignmentTarget } from '../../domain/AssignmentTarget';
import type { OrganizationId, UserId } from '../../domain/ids';
import { readJsonArray, writeJsonArray } from './JsonFileStore';

// DT-015. Durable, file-based WorkEventRepository adapter - matches
// InMemoryWorkEventRepository's exact behavior/semantics, but survives process restart.
export class FileWorkEventRepository implements WorkEventRepository {
  constructor(private readonly filePath: string) {}

  async findLatestByUserAndTarget(
    organizationId: OrganizationId,
    userId: UserId,
    target: AssignmentTarget,
  ): Promise<WorkEvent | null> {
    return this.readAll().reduce<WorkEvent | null>((latest, workEvent) => {
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

  async save(workEvent: WorkEvent): Promise<void> {
    const workEvents = readJsonArray<WorkEvent>(this.filePath);
    workEvents.push(workEvent);
    writeJsonArray(this.filePath, workEvents);
  }

  async findAll(): Promise<readonly WorkEvent[]> {
    return this.readAll();
  }

  private readAll(): WorkEvent[] {
    return readJsonArray<WorkEvent>(this.filePath);
  }
}
