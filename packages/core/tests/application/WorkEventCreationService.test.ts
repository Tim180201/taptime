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
import type { AssignmentTarget } from '../../src/domain/AssignmentTarget';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { Customer } from '../../src/domain/Customer';
import type { AcceptedAssignmentValidationResult } from '../../src/business/AssignmentValidationResult';
import type { WorkEvent } from '../../src/domain/WorkEvent';
import type { StartedTimeEntry } from '../../src/domain/TimeEntry';

const organizationId = OrganizationId('org-1');
const userId = UserId('user-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const otherTarget = customerAssignmentTarget(CustomerId('customer-2'));
const assignment: NfcAssignment = {
  id: NfcAssignmentId('assignment-1'),
  organizationId,
  nfcTagId: NfcTagId('tag-1'),
  target,
  active: true,
};
const customer: Customer = { id: CustomerId('customer-1'), organizationId, active: true };
const caller = authenticatedCaller(userId, organizationId);
if (caller.status !== 'authenticated') {
  throw new Error('Expected an authenticated caller fixture.');
}
const acceptedResult: AcceptedAssignmentValidationResult = {
  status: 'accepted',
  assignment,
  target: customer,
  caller,
};

function buildWorkEvent(id: string, occurredAt: string, eventTarget: AssignmentTarget = target): WorkEvent {
  return {
    id: WorkEventId(id),
    organizationId,
    assignmentId: assignment.id,
    nfcTagId: assignment.nfcTagId,
    target: eventTarget,
    triggeredBy: userId,
    occurredAt: createTimestamp(occurredAt),
  };
}

function buildStartedTimeEntry(startWorkEvent: WorkEvent): StartedTimeEntry {
  return {
    id: TimeEntryId('time-entry-1'),
    workEventId: startWorkEvent.id,
    organizationId: startWorkEvent.organizationId,
    userId: startWorkEvent.triggeredBy,
    target: startWorkEvent.target,
    status: 'started',
    startedAt: startWorkEvent.occurredAt,
  };
}

function buildService(currentWorkEventId: string, occurredAt: string, onEvent = vi.fn()) {
  const workEventFactory = new WorkEventFactory(
    () => WorkEventId(currentWorkEventId),
    () => createTimestamp(occurredAt),
  );
  const businessEngine = new BusinessEngine(() => TimeEntryId('time-entry-1'));
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
    () => createTimestamp('2026-07-13T12:00:30.000Z'),
  );
  return { service, workEventRepository, timeEntryRepository, offlineQueue, onEvent };
}

describe('WorkEventCreationService (F-01 orchestration)', () => {
  it('persists and queues a first WorkEvent, saves the started TimeEntry and emits TimeEntryStarted', () => {
    const { service, workEventRepository, timeEntryRepository, offlineQueue, onEvent } = buildService(
      'work-event-start',
      '2026-07-13T12:00:00.000Z',
    );

    service.handleValidatedAssignment(acceptedResult);

    const [savedWorkEvent] = workEventRepository.findAll();
    const activeTimeEntry = timeEntryRepository.findActiveByUser(organizationId, userId);
    expect(savedWorkEvent).toBeDefined();
    expect(activeTimeEntry).toEqual(
      expect.objectContaining({ workEventId: savedWorkEvent?.id, startedAt: savedWorkEvent?.occurredAt }),
    );
    expect(onEvent).toHaveBeenCalledWith({ type: 'TimeEntryStarted', timeEntry: activeTimeEntry });
    expect(offlineQueue.findPending()[0]?.decision).toEqual(
      expect.objectContaining({ status: 'time_entry_started', timeEntry: activeTimeEntry }),
    );
  });

  it('updates the existing TimeEntry to stopped without creating a second entry and queues the stop decision', () => {
    const { service, workEventRepository, timeEntryRepository, offlineQueue, onEvent } = buildService(
      'work-event-stop',
      '2026-07-13T12:00:05.000Z',
    );
    const startWorkEvent = buildWorkEvent('work-event-start', '2026-07-13T12:00:00.000Z');
    const startedTimeEntry = buildStartedTimeEntry(startWorkEvent);
    workEventRepository.save(startWorkEvent);
    timeEntryRepository.save(startedTimeEntry);

    service.handleValidatedAssignment(acceptedResult);

    expect(timeEntryRepository.findAll()).toEqual([
      {
        ...startedTimeEntry,
        status: 'stopped',
        stoppedAt: '2026-07-13T12:00:05.000Z',
        stoppedByWorkEventId: 'work-event-stop',
      },
    ]);
    expect(timeEntryRepository.findActiveByUser(organizationId, userId)).toBeNull();
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TimeEntryStopped', timeEntry: expect.objectContaining({ id: startedTimeEntry.id }) }),
    );
    expect(offlineQueue.findPending()[0]?.decision?.status).toBe('time_entry_stopped');
  });

  it('does not change TimeEntry state for a duplicate and queues/emits DuplicateScanIgnored', () => {
    const { service, workEventRepository, timeEntryRepository, offlineQueue, onEvent } = buildService(
      'work-event-duplicate',
      '2026-07-13T12:00:04.999Z',
    );
    const startWorkEvent = buildWorkEvent('work-event-start', '2026-07-13T12:00:00.000Z');
    const startedTimeEntry = buildStartedTimeEntry(startWorkEvent);
    workEventRepository.save(startWorkEvent);
    timeEntryRepository.save(startedTimeEntry);

    service.handleValidatedAssignment(acceptedResult);

    expect(timeEntryRepository.findAll()).toEqual([startedTimeEntry]);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'DuplicateScanIgnored',
      workEvent: expect.objectContaining({ id: 'work-event-duplicate' }),
      previousWorkEvent: startWorkEvent,
    });
    expect(offlineQueue.findPending()[0]?.decision).toEqual(
      expect.objectContaining({ status: 'duplicate_scan_ignored', previousWorkEvent: startWorkEvent }),
    );
  });

  it('does not change TimeEntry state when another target is active and queues the rejection', () => {
    const { service, timeEntryRepository, offlineQueue } = buildService(
      'work-event-current',
      '2026-07-13T12:00:10.000Z',
    );
    const otherTargetStart = buildWorkEvent('work-event-other-target', '2026-07-13T11:00:00.000Z', otherTarget);
    const activeTimeEntry = buildStartedTimeEntry(otherTargetStart);
    timeEntryRepository.save(activeTimeEntry);

    service.handleValidatedAssignment(acceptedResult);

    expect(timeEntryRepository.findAll()).toEqual([activeTimeEntry]);
    expect(offlineQueue.findPending()[0]?.decision).toEqual({
      status: 'active_entry_for_other_target_rejected',
      workEvent: expect.objectContaining({ id: 'work-event-current' }),
      activeTimeEntry,
    });
  });

  it('always stores and queues a backward WorkEvent but does not change TimeEntry state on escalation', () => {
    const { service, workEventRepository, timeEntryRepository, offlineQueue } = buildService(
      'work-event-backward',
      '2026-07-13T11:59:59.999Z',
    );
    const startWorkEvent = buildWorkEvent('work-event-start', '2026-07-13T12:00:00.000Z');
    const activeTimeEntry = buildStartedTimeEntry(startWorkEvent);
    workEventRepository.save(startWorkEvent);
    timeEntryRepository.save(activeTimeEntry);

    service.handleValidatedAssignment(acceptedResult);

    expect(workEventRepository.findAll()).toHaveLength(2);
    expect(timeEntryRepository.findAll()).toEqual([activeTimeEntry]);
    expect(offlineQueue.findPending()[0]?.decision).toEqual(
      expect.objectContaining({
        status: 'escalation_required',
        reason: 'work_event_precedes_active_time_entry',
      }),
    );
  });
});
