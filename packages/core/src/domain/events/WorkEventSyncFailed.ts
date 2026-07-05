import type { QueuedWorkEventRecord } from '../QueuedWorkEventRecord';

// TTAP-001 names a single WorkEventSyncFailed event (no separate "conflict" event is
// approved). 'outcome' carries the distinction so a conflict is never indistinguishable from
// a plain retryable failure (Development Sprint 004 Plan, Section 6/13).
export type WorkEventSyncFailureOutcome = 'retryable_failure' | 'conflict';

export interface WorkEventSyncFailed {
  readonly type: 'WorkEventSyncFailed';
  readonly record: QueuedWorkEventRecord;
  readonly outcome: WorkEventSyncFailureOutcome;
  readonly reason: string;
}

export function workEventSyncFailed(
  record: QueuedWorkEventRecord,
  outcome: WorkEventSyncFailureOutcome,
  reason: string,
): WorkEventSyncFailed {
  return { type: 'WorkEventSyncFailed', record, outcome, reason };
}
