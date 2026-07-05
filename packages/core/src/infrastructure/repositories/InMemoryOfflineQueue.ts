import type { OfflineQueue, EnqueueResult } from '../../ports/OfflineQueue';
import type { QueuedWorkEventRecord } from '../../domain/QueuedWorkEventRecord';
import type { WorkEventId } from '../../domain/ids';
import type { SyncState } from '../../domain/SyncState';

export class InMemoryOfflineQueue implements OfflineQueue {
  private readonly records = new Map<string, QueuedWorkEventRecord>();

  enqueue(record: QueuedWorkEventRecord): EnqueueResult {
    if (this.records.has(record.workEvent.id)) {
      return { status: 'already_queued', workEventId: record.workEvent.id };
    }

    this.records.set(record.workEvent.id, record);
    return { status: 'enqueued', record };
  }

  findPending(): readonly QueuedWorkEventRecord[] {
    return Array.from(this.records.values()).filter((record) => record.syncState === 'pending');
  }

  updateSyncState(workEventId: WorkEventId, syncState: SyncState): void {
    const existing = this.records.get(workEventId);
    if (existing === undefined) {
      return;
    }

    this.records.set(workEventId, { ...existing, syncState });
  }
}
