import type { WorkEventRepository } from '../../ports/WorkEventRepository';
import type { WorkEvent } from '../../domain/WorkEvent';

export class InMemoryWorkEventRepository implements WorkEventRepository {
  private readonly workEvents: WorkEvent[] = [];

  save(workEvent: WorkEvent): void {
    this.workEvents.push(workEvent);
  }

  findAll(): readonly WorkEvent[] {
    return this.workEvents;
  }
}
