// TTAP-001 Runtime Architecture: "Errors shall be categorized as recoverable, retryable,
// deferred, conflict or fatal." Exactly these five values, no more (DT-009).
//
// Lives in domain/, not application/, so business-layer classification functions (which
// must classify AssignmentValidationResult/BusinessEngineDecision from within business/) can
// depend on it without inverting the approved dependency direction (Business depends on
// Domain, never the reverse; Application depends on both) - EP-008 Ch03 5.7/Dependency
// Direction.
export type ErrorCategory = 'recoverable' | 'retryable' | 'deferred' | 'conflict' | 'fatal';
