import type { CustomerId } from './ids';

// Per ADR-0002, the target type must remain extensible beyond "customer" (project, room,
// vehicle, etc.), even though v1 only implements the customer target type.
export type AssignmentTarget = {
  readonly targetType: 'customer';
  readonly targetId: CustomerId;
};

export function customerAssignmentTarget(customerId: CustomerId): AssignmentTarget {
  return { targetType: 'customer', targetId: customerId };
}
