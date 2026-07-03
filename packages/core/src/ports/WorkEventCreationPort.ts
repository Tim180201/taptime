import type { AcceptedAssignmentValidationResult } from '../business/AssignmentValidationResult';

// Boundary seam only. DT-004 (WorkEventFactory) and DT-005 (BusinessEngine) own the
// implementation; no implementation or business logic may be added here in this sprint.
export interface WorkEventCreationPort {
  handleValidatedAssignment(result: AcceptedAssignmentValidationResult): void;
}
