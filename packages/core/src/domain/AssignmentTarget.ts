import type { CustomerId, ProjectId, WorkTargetId } from './ids';

export type CustomerWorkTarget = {
  readonly targetType: 'customer';
  readonly targetId: CustomerId;
};

export type ProjectWorkTarget = {
  readonly targetType: 'project';
  readonly targetId: ProjectId;
};

export type GeneralWorkTarget = {
  readonly targetType: 'general_work';
  readonly targetId: WorkTargetId;
};

/** Closed DA5 WorkTarget union. NFC assignments remain Customer-only. */
export type WorkTarget = CustomerWorkTarget | ProjectWorkTarget | GeneralWorkTarget;

/** Historical name retained for source compatibility with DA1–DA4. */
export type AssignmentTarget = WorkTarget;

export function customerAssignmentTarget(customerId: CustomerId): CustomerWorkTarget {
  return { targetType: 'customer', targetId: customerId };
}

export function projectWorkTarget(projectId: ProjectId): ProjectWorkTarget {
  return { targetType: 'project', targetId: projectId };
}

export function generalWorkTarget(targetId: WorkTargetId): GeneralWorkTarget {
  return { targetType: 'general_work', targetId };
}
