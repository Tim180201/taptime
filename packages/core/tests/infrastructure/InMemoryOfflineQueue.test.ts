import { describe, expect, it } from 'vitest';
import { InMemoryOfflineQueue } from '../../src/infrastructure/repositories/InMemoryOfflineQueue';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { WorkEvent } from '../../src/domain/WorkEvent';
import type { QueuedWorkEventRecord } from '../../src/domain/QueuedWorkEventRecord';

function buildWorkEvent(id = 'work-event-1'): WorkEvent {
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

describe('InMemoryOfflineQueue (DT-007)', () => {
  it('enqueues a new record and reports it as enqueued', () => {
    const queue = new InMemoryOfflineQueue();
    const record = buildRecord(buildWorkEvent());

    const result = queue.enqueue(record);

    expect(result).toEqual({ status: 'enqueued', record });
  });

  it('reports an explicit already_queued result instead of throwing for a duplicate WorkEvent', () => {
    const queue = new InMemoryOfflineQueue();
    const workEvent = buildWorkEvent();
    queue.enqueue(buildRecord(workEvent));

    const result = queue.enqueue(buildRecord(workEvent));

    expect(result).toEqual({ status: 'already_queued', workEventId: workEvent.id });
  });

  it('does not overwrite the original record on a duplicate enqueue attempt', () => {
    const queue = new InMemoryOfflineQueue();
    const workEvent = buildWorkEvent();
    queue.enqueue(buildRecord(workEvent));

    queue.enqueue(buildRecord(workEvent));

    expect(queue.findPending()).toHaveLength(1);
  });

  it('retrieves only pending records', () => {
    const queue = new InMemoryOfflineQueue();
    const pendingWorkEvent = buildWorkEvent('work-event-1');
    const synchronizedRecord: QueuedWorkEventRecord = {
      ...buildRecord(buildWorkEvent('work-event-2')),
      syncState: 'synchronized',
    };
    queue.enqueue(buildRecord(pendingWorkEvent));
    queue.enqueue(synchronizedRecord);

    const pending = queue.findPending();

    expect(pending).toHaveLength(1);
    const [pendingRecord] = pending;
    if (!pendingRecord) {
      throw new Error('Expected one pending offline queue record.');
    }
    expect(pendingRecord.workEvent.id).toBe(pendingWorkEvent.id);
  });

  it('returns an empty list when nothing has been queued', () => {
    const queue = new InMemoryOfflineQueue();

    expect(queue.findPending()).toEqual([]);
  });

  it('updateSyncState (DT-008) transitions a record out of findPending once synchronized', () => {
    const queue = new InMemoryOfflineQueue();
    const workEvent = buildWorkEvent();
    queue.enqueue(buildRecord(workEvent));

    queue.updateSyncState(workEvent.id, 'synchronized');

    expect(queue.findPending()).toEqual([]);
  });

  it('updateSyncState (DT-008) does nothing for a WorkEvent id that was never enqueued', () => {
    const queue = new InMemoryOfflineQueue();

    expect(() => queue.updateSyncState(WorkEventId('never-enqueued'), 'synchronized')).not.toThrow();
    expect(queue.findPending()).toEqual([]);
  });
});
