import type { QueuedWorkEventRecord } from '../domain/QueuedWorkEventRecord';
import type { SynchronizationResult } from '../application/SynchronizationResult';

// DT-008. Represents the remote synchronization target. Must not make or alter business
// decisions and must not read QueuedWorkEventRecord.decision for anything other than
// forwarding it untouched (ADR-0005, ADR-0006). No real network/database client is used
// this sprint (ADR-0007, deferred).
export interface SynchronizationGateway {
  synchronize(record: QueuedWorkEventRecord): Promise<SynchronizationResult>;
}
