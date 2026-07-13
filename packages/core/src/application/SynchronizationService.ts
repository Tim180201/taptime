import type { OfflineQueue } from '../ports/OfflineQueue';
import type { SynchronizationGateway } from '../ports/SynchronizationGateway';
import { workEventSynchronized, type WorkEventSynchronized } from '../domain/events/WorkEventSynchronized';
import { workEventSyncFailed, type WorkEventSyncFailed } from '../domain/events/WorkEventSyncFailed';

type SynchronizationEvent = WorkEventSynchronized | WorkEventSyncFailed;

// DT-008. Reads pending records from the OfflineQueue (DT-007), attempts synchronization
// against a SynchronizationGateway, and transitions each record's SyncState accordingly.
// Orchestrates only; it does not interpret QueuedWorkEventRecord.decision, only forwards it
// unchanged (ADR-0005/ADR-0006). A single attempt per record per call - no retry scheduling
// or backoff (Development Sprint 004 Plan, Section 7, out of scope).
export class SynchronizationService {
  constructor(
    private readonly offlineQueue: OfflineQueue,
    private readonly synchronizationGateway: SynchronizationGateway,
    private readonly onEvent: (event: SynchronizationEvent) => void = () => {},
  ) {}

  async synchronizePending(): Promise<void> {
    for (const record of await this.offlineQueue.findPending()) {
      const result = await this.synchronizationGateway.synchronize(record);

      if (result.status === 'synchronized') {
        await this.offlineQueue.updateSyncState(record.workEvent.id, 'synchronized');
        this.onEvent(workEventSynchronized({ ...record, syncState: 'synchronized' }));
        continue;
      }

      if (result.status === 'conflict') {
        await this.offlineQueue.updateSyncState(record.workEvent.id, 'failed');
        this.onEvent(workEventSyncFailed({ ...record, syncState: 'failed' }, 'conflict', result.reason));
        continue;
      }

      // retryable_failure: SyncState is left as 'pending' - the record is never dropped from
      // the queue and remains visible to a future synchronization pass.
      this.onEvent(workEventSyncFailed(record, 'retryable_failure', result.reason));
    }
  }
}
