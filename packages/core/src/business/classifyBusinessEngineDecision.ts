import type { BusinessEngineDecision } from './BusinessEngineDecision';
import type { ErrorCategory } from '../domain/ErrorCategory';

// DT-009. 'escalation_required' is classified as 'deferred' - it documents the existing
// Finding F-01 placeholder (BusinessEngineDecision's own comment: "a deliberate placeholder,
// not a business decision"); classification does not resolve F-01, only labels it.
export function classifyBusinessEngineDecision(decision: BusinessEngineDecision): ErrorCategory | null {
  if (decision.status === 'time_entry_started') {
    return null;
  }

  return 'deferred';
}
