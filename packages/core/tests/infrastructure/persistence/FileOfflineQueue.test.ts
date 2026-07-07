import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileOfflineQueue } from '../../../src/infrastructure/persistence/FileOfflineQueue';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId } from '../../../src/domain/ids';
import { customerAssignmentTarget } from '../../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../../src/domain/Timestamp';
import type { WorkEvent } from '../../../src/domain/WorkEvent';
import type { QueuedWorkEventRecord } from '../../../src/domain/QueuedWorkEventRecord';

function buildWorkEvent(id = 'work-event-1'): WorkEvent {
  return {
    id: WorkEventId(id),
    organizationId: OrganizationId('org-1'),
    assignmentId: NfcAssignmentId('assignment-1'),
    nfcTagId: NfcTagId('tag-1'),
    target: customerAssignmentTarget(CustomerId('customer-1')),
    triggeredBy: UserId('user-1'),
    occurredAt: createTimestamp('2026-07-07T09:00:00.000Z'),
  };
}

function buildRecord(workEvent: WorkEvent): QueuedWorkEventRecord {
  return {
    workEvent,
    decision: null,
    syncState: 'pending',
    queuedAt: createTimestamp('2026-07-07T09:00:01.000Z'),
  };
}

// DT-015: mirrors InMemoryOfflineQueue.test.ts's coverage exactly, plus a dedicated
// "survives restart" test - the core proof this sprint exists to deliver.
describe('FileOfflineQueue (DT-015)', () => {
  let tempDirectory: string;
  let filePath: string;

  beforeEach(() => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'taptime-file-offline-queue-'));
    filePath = join(tempDirectory, 'offline-queue.json');
  });

  afterEach(() => {
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('enqueues a new record and reports it as enqueued', () => {
    const queue = new FileOfflineQueue(filePath);
    const record = buildRecord(buildWorkEvent());

    const result = queue.enqueue(record);

    expect(result).toEqual({ status: 'enqueued', record });
  });

  it('reports an explicit already_queued result instead of throwing for a duplicate WorkEvent', () => {
    const queue = new FileOfflineQueue(filePath);
    const workEvent = buildWorkEvent();
    queue.enqueue(buildRecord(workEvent));

    const result = queue.enqueue(buildRecord(workEvent));

    expect(result).toEqual({ status: 'already_queued', workEventId: workEvent.id });
  });

  it('does not overwrite the original record on a duplicate enqueue attempt', () => {
    const queue = new FileOfflineQueue(filePath);
    const workEvent = buildWorkEvent();
    queue.enqueue(buildRecord(workEvent));

    queue.enqueue(buildRecord(workEvent));

    expect(queue.findPending()).toHaveLength(1);
  });

  it('retrieves only pending records', () => {
    const queue = new FileOfflineQueue(filePath);
    const pendingWorkEvent = buildWorkEvent('work-event-1');
    const synchronizedRecord: QueuedWorkEventRecord = {
      ...buildRecord(buildWorkEvent('work-event-2')),
      syncState: 'synchronized',
    };
    queue.enqueue(buildRecord(pendingWorkEvent));
    queue.enqueue(synchronizedRecord);

    const pending = queue.findPending();

    expect(pending).toHaveLength(1);
    expect(pending[0]?.workEvent.id).toBe(pendingWorkEvent.id);
  });

  it('returns an empty list when nothing has been queued', () => {
    const queue = new FileOfflineQueue(filePath);

    expect(queue.findPending()).toEqual([]);
  });

  it('updateSyncState transitions a record out of findPending once synchronized', () => {
    const queue = new FileOfflineQueue(filePath);
    const workEvent = buildWorkEvent();
    queue.enqueue(buildRecord(workEvent));

    queue.updateSyncState(workEvent.id, 'synchronized');

    expect(queue.findPending()).toEqual([]);
  });

  it('updateSyncState does nothing for a WorkEvent id that was never enqueued', () => {
    const queue = new FileOfflineQueue(filePath);

    expect(() => queue.updateSyncState(WorkEventId('never-enqueued'), 'synchronized')).not.toThrow();
    expect(queue.findPending()).toEqual([]);
  });

  it('survives a simulated process restart: a fresh instance reads what a previous instance wrote', () => {
    const firstInstance = new FileOfflineQueue(filePath);
    const workEvent = buildWorkEvent();
    firstInstance.enqueue(buildRecord(workEvent));

    const secondInstance = new FileOfflineQueue(filePath);

    expect(secondInstance.findPending()).toEqual([buildRecord(workEvent)]);
  });

  it('survives a simulated process restart after a state transition made by a previous instance', () => {
    const firstInstance = new FileOfflineQueue(filePath);
    const workEvent = buildWorkEvent();
    firstInstance.enqueue(buildRecord(workEvent));
    firstInstance.updateSyncState(workEvent.id, 'synchronized');

    const secondInstance = new FileOfflineQueue(filePath);

    expect(secondInstance.findPending()).toEqual([]);
  });
});
