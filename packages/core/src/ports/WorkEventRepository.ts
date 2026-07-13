import type { WorkEvent } from '../domain/WorkEvent';
import type { AssignmentTarget } from '../domain/AssignmentTarget';
import type { OrganizationId, UserId } from '../domain/ids';

export interface WorkEventRepository {
  findLatestByUserAndTarget(
    organizationId: OrganizationId,
    userId: UserId,
    target: AssignmentTarget,
  ): Promise<WorkEvent | null>;
  save(workEvent: WorkEvent): Promise<void>;
}
