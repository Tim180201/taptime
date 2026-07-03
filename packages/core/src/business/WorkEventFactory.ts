import type { AcceptedAssignmentValidationResult } from './AssignmentValidationResult';
import type { WorkEvent } from '../domain/WorkEvent';
import { WorkEventId } from '../domain/ids';
import { generateId } from '../domain/generateId';
import { createTimestamp, type Timestamp } from '../domain/Timestamp';

// DT-004. Only accepts AcceptedAssignmentValidationResult, so a rejected validation result
// cannot be passed in at all (TypeScript-enforced, not a runtime check) - satisfies "Invalid
// inputs do not create WorkEvents" structurally.
export class WorkEventFactory {
  constructor(
    private readonly newWorkEventId: () => WorkEventId = () => WorkEventId(generateId()),
    private readonly now: () => Timestamp = () => createTimestamp(new Date().toISOString()),
  ) {}

  createFromAcceptedAssignment(result: AcceptedAssignmentValidationResult): WorkEvent {
    return {
      id: this.newWorkEventId(),
      organizationId: result.assignment.organizationId,
      assignmentId: result.assignment.id,
      nfcTagId: result.assignment.nfcTagId,
      target: result.assignment.target,
      triggeredBy: result.caller.userId,
      occurredAt: this.now(),
    };
  }
}
