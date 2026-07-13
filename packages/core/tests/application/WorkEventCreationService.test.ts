import { describe, expect, it, vi } from 'vitest';
import { WorkEventCreationService } from '../../src/application/WorkEventCreationService';
import { WorkEventFactory } from '../../src/business/WorkEventFactory';
import { BusinessEngine } from '../../src/business/BusinessEngine';
import { InMemoryWorkEventRepository } from '../../src/infrastructure/repositories/InMemoryWorkEventRepository';
import { InMemoryTimeEntryRepository } from '../../src/infrastructure/repositories/InMemoryTimeEntryRepository';
import { InMemoryOfflineQueue } from '../../src/infrastructure/repositories/InMemoryOfflineQueue';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId, TimeEntryId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller } from '../../src/domain/CallerContext';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { Customer } from '../../src/domain/Customer';
import type { AcceptedAssignmentValidationResult } from '../../src/business/AssignmentValidationResult';
import type { TimeEntry } from '../../src/domain/TimeEntry';

const organizationId = OrganizationId('org-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const assignment: NfcAssignment = {
  id: NfcAssignmentId('assignment-1'),
  organizationId,
  nfcTagId: NfcTagId('tag-1'),
  target,
  active: true,
};
const customer: Customer = { id: CustomerId('customer-1'), organizationId, active: true };
const caller = authenticatedCaller(UserId('user-1'), organizationId);
if (caller.status !== 'authenticated') {
  throw new Error('Expected an authenticated caller fixture.');
}
const acceptedResult: AcceptedAssignmentValidationResult = {
  status: 'accepted',
  assignment,
  target: customer,
  caller,
};

function buildService(onEvent = vi.fn()) {
  const workEventFactory = new WorkEventFactory(
    () => WorkEventId('work-event-1'),
    () => createTimestamp('2026-07-03T12:00:00.000Z'),
  );
  const businessEngine = new BusinessEngine(
    () => TimeEntryId('time-entry-1'),
    () => createTimestamp('2026-07-03T12:00:01.000Z'),
  );
  const workEventRepository = new InMemoryWorkEventRepository();
  const timeEntryRepository = new InMemoryTimeEntryRepository();
  const offlineQueue = new InMemoryOfflineQueue();
  const service = new WorkEventCreationService(
    workEventFactory,
    businessEngine,
    workEventRepository,
    timeEntryRepository,
    offlineQueue,
    onEvent,
    () => createTimestamp('2026-07-03T12:00:02.000Z'),
  );
  return { service, workEventRepository, timeEntryRepository, offlineQueue, onEvent };
}

describe('WorkEventCreationService (WorkEventCreationPort implementation)', () => {
  it('creates and persists a WorkEvent, then a TimeEntry, when no active TimeEntry exists, and enqueues it for sync', () => {
    const { service, workEventRepository, timeEntryRepository, offlineQueue, onEvent } = buildService();

    service.handleValidatedAssignment(acceptedResult);

    expect(workEventRepository.findAll()).toHaveLength(1);
    expect(timeEntryRepository.findActiveByTarget(organizationId, target)).not.toBeNull();
    expect(onEvent).toHaveBeenNthCalledWith(1, { type: 'WorkEventCreated', workEvent: workEventRepository.findAll()[0] });
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      type: 'TimeEntryStarted',
      timeEntry: timeEntryRepository.findActiveByTarget(organizationId, target),
    });
    const pending = offlineQueue.findPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toEqual({
      workEvent: workEventRepository.findAll()[0],
      decision: { status: 'time_entry_started', timeEntry: timeEntryRepository.findActiveByTarget(organizationId, target), event: expect.any(Object) },
      syncState: 'pending',
      queuedAt: '2026-07-03T12:00:02.000Z',
    });
    expect(onEvent).toHaveBeenNthCalledWith(3, { type: 'WorkEventQueuedForSync', record: pending[0] });
  });

  it('always persists and enqueues the WorkEvent for auditability, even when escalation is required', () => {
    const { service, workEventRepository, timeEntryRepository, offlineQueue, onEvent } = buildService();
    const preExistingActiveTimeEntry: TimeEntry = {
      id: TimeEntryId('time-entry-existing'),
      workEventId: WorkEventId('work-event-existing'),
      organizationId,
      target,
      status: 'started',
      startedAt: createTimestamp('2026-07-03T11:00:00.000Z'),
    };
    timeEntryRepository.save(preExistingActiveTimeEntry);

    service.handleValidatedAssignment(acceptedResult);

    expect(workEventRepository.findAll()).toHaveLength(1);
    expect(timeEntryRepository.findAll()).toEqual([preExistingActiveTimeEntry]);
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(1, { type: 'WorkEventCreated', workEvent: workEventRepository.findAll()[0] });

    const pending = offlineQueue.findPending();
    expect(pending).toHaveLength(1);
    const [pendingRecord] = pending;
    if (!pendingRecord) {
      throw new Error('Expected one pending offline queue record.');
    }
    expect(pendingRecord.decision).toEqual({
      status: 'escalation_required',
      reason: 'duplicate_scan_rule_undefined',
      workEvent: workEventRepository.findAll()[0],
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, { type: 'WorkEventQueuedForSync', record: pendingRecord });
  });
});
