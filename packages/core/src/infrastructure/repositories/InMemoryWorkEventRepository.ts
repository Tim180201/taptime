import type { WorkEventRepository } from '../../ports/WorkEventRepository';
import type { WorkEvent } from '../../domain/WorkEvent';
import type { AssignmentTarget } from '../../domain/AssignmentTarget';
import type { OrganizationId, UserId } from '../../domain/ids';

export class InMemoryWorkEventRepository implements WorkEventRepository {
  private readonly workEvents: WorkEvent[] = [];

  findLatestByUserAndTarget(
    organizationId: OrganizationId,
    userId: UserId,
    target: AssignmentTarget,
  ): WorkEvent | null {
    return this.workEvents.reduce<WorkEvent | null>((latest, workEvent) => {
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
    this.workEvents.push(workEvent);
  }

  findAll(): readonly WorkEvent[] {
    return this.workEvents;
  }
}
