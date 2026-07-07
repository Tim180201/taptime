import type { SynchronizationResult } from './SynchronizationResult';
import type { ErrorCategory } from '../domain/ErrorCategory';

// DT-009. Direct name match to TTAP-001's taxonomy: 'retryable_failure' -> 'retryable',
// 'conflict' -> 'conflict' - never collapsed into one case (established since DT-008).
export function classifySynchronizationResult(result: SynchronizationResult): ErrorCategory | null {
  if (result.status === 'synchronized') {
    return null;
  }

  return result.status === 'conflict' ? 'conflict' : 'retryable';
}
