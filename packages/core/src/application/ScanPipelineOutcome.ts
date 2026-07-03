import type { AssignmentResolutionRejectionReason } from '../domain/events/NfcAssignmentResolution';
import type { AssignmentValidationResult } from '../business/AssignmentValidationResult';

// Explicit outcome per pipeline stage so the employee always receives a clear result
// (FB-001 Business Rules: "clear outcome for accepted, rejected, duplicate or deferred scans").
export type ScanPipelineOutcome =
  | { readonly stage: 'capture'; readonly status: 'unreadable' }
  | { readonly stage: 'resolution'; readonly status: 'rejected'; readonly reason: AssignmentResolutionRejectionReason }
  | { readonly stage: 'validation'; readonly result: AssignmentValidationResult };
