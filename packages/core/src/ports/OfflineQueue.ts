import type { QueuedWorkEventRecord } from '../domain/QueuedWorkEventRecord';
import type { WorkEventId } from '../domain/ids';

export type EnqueueResult =
  | { readonly status: 'enqueued'; readonly record: QueuedWorkEventRecord }
  | { readonly status: 'already_queued'; readonly workEventId: WorkEventId };

// DT-007. Stores WorkEvents pending synchronization. Must not make or alter business
// decisions (ADR-0005) and must not depend on a real network/database client (ADR-0007,
// Development Sprint 003 Plan Section 7 - deferred).
export interface OfflineQueue {
  enqueue(record: QueuedWorkEventRecord): EnqueueResult;
  findPending(): readonly QueuedWorkEventRecord[];
}
