import type { ScanPipelineOutcome } from './ScanPipelineOutcome';
import type { AssignmentResolutionRejectionReason } from '../domain/events/NfcAssignmentResolution';
import type { ErrorCategory } from '../domain/ErrorCategory';
import { classifyAssignmentValidationResult } from '../business/classifyAssignmentValidationResult';

// DT-009. Mapping rationale: an unreadable payload is 'recoverable' - the employee's
// immediate next scan attempt can resolve it. 'unknown_tag'/'inactive_assignment' are also
// 'recoverable': the employee's immediate next action (scanning a different, correct or
// active tag) is within their own control and needs no administrator intervention, unlike
// the AssignmentValidator reasons classified 'fatal' in classifyAssignmentValidationResult().
const RESOLUTION_REJECTION_CATEGORIES: Record<AssignmentResolutionRejectionReason, ErrorCategory> = {
  unknown_tag: 'recoverable',
  inactive_assignment: 'recoverable',
};

export function classifyScanPipelineOutcome(outcome: ScanPipelineOutcome): ErrorCategory | null {
  if (outcome.stage === 'capture') {
    return 'recoverable';
  }

  if (outcome.stage === 'resolution') {
    return RESOLUTION_REJECTION_CATEGORIES[outcome.reason];
  }

  return classifyAssignmentValidationResult(outcome.result);
}
