import type { WorkEvent } from '../domain/WorkEvent';

export interface WorkEventRepository {
  save(workEvent: WorkEvent): void;
}
