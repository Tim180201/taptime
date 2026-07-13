import { describe, expect, it, vi } from 'vitest';
import { SynchronizationService } from '../../src/application/SynchronizationService';
import { InMemoryOfflineQueue } from '../../src/infrastructure/repositories/InMemoryOfflineQueue';
import { FakeSynchronizationGateway } from '../../src/infrastructure/adapters/FakeSynchronizationGateway';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { WorkEvent } from '../../src/domain/WorkEvent';
import type { QueuedWorkEventRecord } from '../../src/domain/QueuedWorkEventRecord';

function buildWorkEvent(id: string): WorkEvent {
  return {
    id: WorkEventId(id),
    organizationId: OrganizationId('org-1'),
    assignmentId: NfcAssignmentId('assignment-1'),
    nfcTagId: NfcTagId('tag-1'),
    target: customerAssignmentTarget(CustomerId('customer-1')),
    triggeredBy: UserId('user-1'),
    occurredAt: createTimestamp('2026-07-05T09:00:00.000Z'),
  };
}

function buildRecord(workEvent: WorkEvent): QueuedWorkEventRecord {
  return {
    workEvent,
    decision: null,
    syncState: 'pending',
    queuedAt: createTimestamp('2026-07-05T09:00:01.000Z'),
  };
}

function buildService(onEvent = vi.fn()) {
  const offlineQueue = new InMemoryOfflineQueue();
  const gateway = new FakeSynchronizationGateway();
  const service = new SynchronizationService(offlineQueue, gateway, onEvent);
  return { service, offlineQueue, gateway, onEvent };
}

describe('SynchronizationService (DT-008)', () => {
  it('transitions a pending record to synchronized on gateway success and emits WorkEventSynchronized', async () => {
    const { service, offlineQueue, gateway, onEvent } = buildService();
    const workEvent = buildWorkEvent('work-event-1');
    await offlineQueue.enqueue(buildRecord(workEvent));
    gateway.configureSuccess();

    await service.synchronizePending();

    expect(await offlineQueue.findPending()).toHaveLength(0);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WorkEventSynchronized',
        record: expect.objectContaining({ syncState: 'synchronized' }),
      }),
    );
  });

  it('leaves a record pending (never dropped) on a retryable failure and emits WorkEventSyncFailed', async () => {
    const { service, offlineQueue, gateway, onEvent } = buildService();
    const workEvent = buildWorkEvent('work-event-1');
    await offlineQueue.enqueue(buildRecord(workEvent));
    gateway.configureRetryableFailure('network timeout');

    await service.synchronizePending();

    expect(await offlineQueue.findPending()).toHaveLength(1);
    expect((await offlineQueue.findPending())[0]?.syncState).toBe('pending');
    expect(onEvent).toHaveBeenCalledWith({
      type: 'WorkEventSyncFailed',
      record: expect.objectContaining({ syncState: 'pending' }),
      outcome: 'retryable_failure',
      reason: 'network timeout',
    });
  });

  it('produces a distinct, observable conflict outcome, never collapsed into a plain retryable failure', async () => {
    const { service, offlineQueue, gateway, onEvent } = buildService();
    const workEvent = buildWorkEvent('work-event-1');
    await offlineQueue.enqueue(buildRecord(workEvent));
    gateway.configureConflict('remote record already modified');

    await service.synchronizePending();

    expect(await offlineQueue.findPending()).toHaveLength(0);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'WorkEventSyncFailed',
      record: expect.objectContaining({ syncState: 'failed' }),
      outcome: 'conflict',
      reason: 'remote record already modified',
    });
  });

  it('does not read or branch on QueuedWorkEventRecord.decision for anything other than forwarding it', async () => {
    const { service, offlineQueue, gateway, onEvent } = buildService();
    const workEvent = buildWorkEvent('work-event-1');
    const recordWithDecision: QueuedWorkEventRecord = {
      ...buildRecord(workEvent),
      decision: {
        status: 'escalation_required',
        reason: 'work_event_precedes_previous_accepted_work_event',
        workEvent,
      },
    };
    await offlineQueue.enqueue(recordWithDecision);
    gateway.configureSuccess();

    await service.synchronizePending();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({ decision: recordWithDecision.decision }),
      }),
    );
  });

  it('synchronizes every pending record in a single pass', async () => {
    const { service, offlineQueue, gateway } = buildService();
    await offlineQueue.enqueue(buildRecord(buildWorkEvent('work-event-1')));
    await offlineQueue.enqueue(buildRecord(buildWorkEvent('work-event-2')));
    gateway.configureSuccess();

    await service.synchronizePending();

    expect(await offlineQueue.findPending()).toHaveLength(0);
  });
});
