import type { OfflineQueue, EnqueueResult } from '../../ports/OfflineQueue';
import type { QueuedWorkEventRecord } from '../../domain/QueuedWorkEventRecord';
import type { WorkEventId } from '../../domain/ids';
import type { SyncState } from '../../domain/SyncState';
import { readJsonArray, writeJsonArray } from './JsonFileStore';

// DT-015. Durable, file-based OfflineQueue adapter - matches InMemoryOfflineQueue's exact
// behavior/semantics (including its already_queued duplicate handling), but survives process
// restart. Single-process, single-writer scenario only this sprint - no locking or
// concurrent-writer handling (documented limitation, Development Sprint 010 Plan Section 12).
export class FileOfflineQueue implements OfflineQueue {
  constructor(private readonly filePath: string) {}

  async enqueue(record: QueuedWorkEventRecord): Promise<EnqueueResult> {
    const records = this.readAll();
    if (records.some((existing) => existing.workEvent.id === record.workEvent.id)) {
      return { status: 'already_queued', workEventId: record.workEvent.id };
    }

    records.push(record);
    this.writeAll(records);
    return { status: 'enqueued', record };
  }

  async findPending(): Promise<readonly QueuedWorkEventRecord[]> {
    return this.readAll().filter((record) => record.syncState === 'pending');
  }

  async updateSyncState(workEventId: WorkEventId, syncState: SyncState): Promise<void> {
    const records = this.readAll();
    const index = records.findIndex((record) => record.workEvent.id === workEventId);
    if (index === -1) {
      return;
    }

    const existing = records[index];
    if (existing === undefined) {
      return;
    }

    records[index] = { ...existing, syncState };
    this.writeAll(records);
  }

  private readAll(): QueuedWorkEventRecord[] {
    return readJsonArray<QueuedWorkEventRecord>(this.filePath);
  }

  private writeAll(records: readonly QueuedWorkEventRecord[]): void {
    writeJsonArray(this.filePath, records);
  }
}
