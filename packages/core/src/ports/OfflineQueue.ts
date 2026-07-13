import type { QueuedWorkEventRecord } from '../domain/QueuedWorkEventRecord';
import type { WorkEventId } from '../domain/ids';
import type { SyncState } from '../domain/SyncState';

export type EnqueueResult =
  | { readonly status: 'enqueued'; readonly record: QueuedWorkEventRecord }
  | { readonly status: 'already_queued'; readonly workEventId: WorkEventId };

// DT-007. Stores WorkEvents pending synchronization. Must not make or alter business
// decisions (ADR-0005) and must not depend on a real network/database client (ADR-0007,
// Development Sprint 003 Plan Section 7 - deferred).
// updateSyncState (DT-008): a narrowly-scoped state transition used only by
// SynchronizationService to record a synchronization outcome - it does not interpret
// business meaning (EP-008 Ch01 5.7/Ch03 5.3).
export interface OfflineQueue {
  enqueue(record: QueuedWorkEventRecord): Promise<EnqueueResult>;
  findPending(): Promise<readonly QueuedWorkEventRecord[]>;
  updateSyncState(workEventId: WorkEventId, syncState: SyncState): Promise<void>;
}
