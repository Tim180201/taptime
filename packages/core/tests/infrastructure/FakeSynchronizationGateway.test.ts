import { describe, expect, it } from 'vitest';
import { FakeSynchronizationGateway } from '../../src/infrastructure/adapters/FakeSynchronizationGateway';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { QueuedWorkEventRecord } from '../../src/domain/QueuedWorkEventRecord';

const record: QueuedWorkEventRecord = {
  workEvent: {
    id: WorkEventId('work-event-1'),
    organizationId: OrganizationId('org-1'),
    assignmentId: NfcAssignmentId('assignment-1'),
    nfcTagId: NfcTagId('tag-1'),
    target: customerAssignmentTarget(CustomerId('customer-1')),
    triggeredBy: UserId('user-1'),
    occurredAt: createTimestamp('2026-07-05T09:00:00.000Z'),
  },
  decision: null,
  syncState: 'pending',
  queuedAt: createTimestamp('2026-07-05T09:00:01.000Z'),
};

describe('FakeSynchronizationGateway (DT-008)', () => {
  it('is synchronized by default', async () => {
    const gateway = new FakeSynchronizationGateway();

    expect(await gateway.synchronize(record)).toEqual({ status: 'synchronized' });
  });

  it('returns a configured retryable_failure result', async () => {
    const gateway = new FakeSynchronizationGateway();
    gateway.configureRetryableFailure('network timeout');

    expect(await gateway.synchronize(record)).toEqual({ status: 'retryable_failure', reason: 'network timeout' });
  });

  it('returns a configured conflict result, distinct from retryable_failure', async () => {
    const gateway = new FakeSynchronizationGateway();
    gateway.configureConflict('remote record already modified');

    expect(await gateway.synchronize(record)).toEqual({
      status: 'conflict',
      reason: 'remote record already modified',
    });
  });

  it('can be reconfigured back to success', async () => {
    const gateway = new FakeSynchronizationGateway();
    gateway.configureConflict('remote record already modified');

    gateway.configureSuccess();

    expect(await gateway.synchronize(record)).toEqual({ status: 'synchronized' });
  });
});
