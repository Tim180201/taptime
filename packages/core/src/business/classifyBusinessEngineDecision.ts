import type { BusinessEngineDecision } from './BusinessEngineDecision';
import type { ErrorCategory } from '../domain/ErrorCategory';

export function classifyBusinessEngineDecision(decision: BusinessEngineDecision): ErrorCategory | null {
  switch (decision.status) {
    case 'time_entry_started':
    case 'time_entry_stopped':
    case 'duplicate_scan_ignored':
      return null;
    case 'active_entry_for_other_target_rejected':
      return 'recoverable';
    case 'escalation_required':
      return 'deferred';
    default:
      return decision satisfies never;
  }
}
