import type { SynchronizationGateway } from '../../ports/SynchronizationGateway';
import type { SynchronizationResult } from '../../application/SynchronizationResult';
import type { QueuedWorkEventRecord } from '../../domain/QueuedWorkEventRecord';

// Manually-configurable test/dev double for DT-008. Emits the same SynchronizationResult
// shape a real gateway adapter would; no real network/database client is used (Development
// Sprint 004 Plan, Section 6/7).
export class FakeSynchronizationGateway implements SynchronizationGateway {
  private nextResult: SynchronizationResult = { status: 'synchronized' };

  configureSuccess(): void {
    this.nextResult = { status: 'synchronized' };
  }

  configureRetryableFailure(reason: string): void {
    this.nextResult = { status: 'retryable_failure', reason };
  }

  configureConflict(reason: string): void {
    this.nextResult = { status: 'conflict', reason };
  }

  async synchronize(_record: QueuedWorkEventRecord): Promise<SynchronizationResult> {
    return this.nextResult;
  }
}
