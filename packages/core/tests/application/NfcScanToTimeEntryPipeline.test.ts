import { describe, expect, it, vi } from 'vitest';
import { FakeNfcScanAdapter } from '../../src/infrastructure/adapters/FakeNfcScanAdapter';
import { InMemoryNfcTagRepository } from '../../src/infrastructure/repositories/InMemoryNfcTagRepository';
import { InMemoryNfcAssignmentRepository } from '../../src/infrastructure/repositories/InMemoryNfcAssignmentRepository';
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryWorkEventRepository } from '../../src/infrastructure/repositories/InMemoryWorkEventRepository';
import { InMemoryTimeEntryRepository } from '../../src/infrastructure/repositories/InMemoryTimeEntryRepository';
import { InMemoryOfflineQueue } from '../../src/infrastructure/repositories/InMemoryOfflineQueue';
import { FakeSynchronizationGateway } from '../../src/infrastructure/adapters/FakeSynchronizationGateway';
import { AssignmentResolver } from '../../src/business/AssignmentResolver';
import { AssignmentValidator } from '../../src/business/AssignmentValidator';
import { WorkEventFactory } from '../../src/business/WorkEventFactory';
import { BusinessEngine } from '../../src/business/BusinessEngine';
import { NfcScanApplicationService } from '../../src/application/NfcScanApplicationService';
import { WorkEventCreationService } from '../../src/application/WorkEventCreationService';
import { SynchronizationService } from '../../src/application/SynchronizationService';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId, TimeEntryId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller } from '../../src/domain/CallerContext';
import { createTimestamp } from '../../src/domain/Timestamp';
import { createNfcPayload } from '../../src/domain/NfcPayload';
import type { NfcTag } from '../../src/domain/NfcTag';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { Customer } from '../../src/domain/Customer';

// Proves the full Business Decision Pipeline (Development Sprint 002 Plan, Section 1):
// NfcScanFact -> AssignmentResolver -> AssignmentValidator -> WorkEventCreationPort
// (WorkEventFactory -> BusinessEngine) -> Decision Result -> Business Event.
describe('NFC scan to TimeEntry pipeline (end-to-end)', () => {
  const organizationId = OrganizationId('org-1');
  const payload = 'known-tag-payload';
  const tag: NfcTag = { id: NfcTagId('tag-1'), organizationId, payload: createNfcPayload(payload) };
  const target = customerAssignmentTarget(CustomerId('customer-1'));
  const assignment: NfcAssignment = {
    id: NfcAssignmentId('assignment-1'),
    organizationId,
    nfcTagId: tag.id,
    target,
    active: true,
  };
  const activeCustomer: Customer = { id: CustomerId('customer-1'), organizationId, active: true };
  const caller = authenticatedCaller(UserId('user-1'), organizationId);

  function buildPipeline() {
    const adapter = new FakeNfcScanAdapter();
    const resolver = new AssignmentResolver(
      new InMemoryNfcTagRepository([tag]),
      new InMemoryNfcAssignmentRepository([assignment]),
    );
    const validator = new AssignmentValidator(new InMemoryCustomerRepository([activeCustomer]));

    const workEventRepository = new InMemoryWorkEventRepository();
    const timeEntryRepository = new InMemoryTimeEntryRepository();
    const offlineQueue = new InMemoryOfflineQueue();
    let workEventCounter = 0;
    const workEventFactory = new WorkEventFactory(
      () => WorkEventId(`work-event-${++workEventCounter}`),
      () => createTimestamp('2026-07-03T12:00:00.000Z'),
    );
    const businessEngine = new BusinessEngine(
      () => TimeEntryId('time-entry-1'),
      () => createTimestamp('2026-07-03T12:00:01.000Z'),
    );
    const onEvent = vi.fn();
    const workEventCreationPort = new WorkEventCreationService(
      workEventFactory,
      businessEngine,
      workEventRepository,
      timeEntryRepository,
      offlineQueue,
      onEvent,
      () => createTimestamp('2026-07-03T12:00:02.000Z'),
    );

    const applicationService = new NfcScanApplicationService(
      adapter,
      resolver,
      validator,
      workEventCreationPort,
      () => createTimestamp('2026-07-03T10:00:00.000Z'),
    );

    const synchronizationGateway = new FakeSynchronizationGateway();
    const synchronizationService = new SynchronizationService(offlineQueue, synchronizationGateway, onEvent);

    return {
      adapter,
      applicationService,
      workEventRepository,
      timeEntryRepository,
      offlineQueue,
      synchronizationGateway,
      synchronizationService,
      onEvent,
    };
  }

  it('turns an accepted scan into an observable TimeEntryStarted when no prior session exists, queues it for sync, and synchronizes it end-to-end', () => {
    const {
      adapter,
      applicationService,
      workEventRepository,
      timeEntryRepository,
      offlineQueue,
      synchronizationGateway,
      synchronizationService,
      onEvent,
    } = buildPipeline();
    adapter.triggerScan(payload);

    const outcome = applicationService.submitScan(caller);

    expect(outcome.stage).toBe('validation');
    expect(workEventRepository.findAll()).toHaveLength(1);
    const startedTimeEntry = timeEntryRepository.findActiveByTarget(organizationId, target);
    expect(startedTimeEntry).not.toBeNull();
    expect(startedTimeEntry?.status).toBe('started');
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'TimeEntryStarted' }));

    const pending = offlineQueue.findPending();
    expect(pending).toHaveLength(1);
    const [pendingRecord] = pending;
    if (!pendingRecord) {
      throw new Error('Expected one pending offline queue record.');
    }
    expect(pendingRecord.workEvent).toEqual(workEventRepository.findAll()[0]);
    expect(pendingRecord.decision).toEqual(expect.objectContaining({ status: 'time_entry_started' }));
    expect(pendingRecord.syncState).toBe('pending');
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'WorkEventQueuedForSync' }));

    synchronizationGateway.configureSuccess();
    synchronizationService.synchronizePending();

    expect(offlineQueue.findPending()).toHaveLength(0);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WorkEventSynchronized',
        record: expect.objectContaining({ syncState: 'synchronized' }),
      }),
    );
  });

  it('does not create a second active TimeEntry for a second scan of the same target, still queues the escalation record (never a guess), and synchronizes both records', () => {
    const { adapter, applicationService, timeEntryRepository, offlineQueue, synchronizationGateway, synchronizationService, onEvent } =
      buildPipeline();
    adapter.triggerScan(payload);
    applicationService.submitScan(caller);

    adapter.triggerScan(payload);
    applicationService.submitScan(caller);

    const activeEntries = timeEntryRepository.findAll().filter((entry) => entry.status === 'started');
    expect(activeEntries).toHaveLength(1);

    const pending = offlineQueue.findPending();
    expect(pending).toHaveLength(2);
    const secondPendingRecord = pending[1];
    if (!secondPendingRecord) {
      throw new Error('Expected a second pending offline queue record.');
    }
    expect(secondPendingRecord.decision).toEqual(
      expect.objectContaining({ status: 'escalation_required', reason: 'duplicate_scan_rule_undefined' }),
    );
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'WorkEventQueuedForSync' }));

    synchronizationGateway.configureSuccess();
    synchronizationService.synchronizePending();

    expect(offlineQueue.findPending()).toHaveLength(0);
    const synchronizedEvents = onEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === 'WorkEventSynchronized');
    expect(synchronizedEvents).toHaveLength(2);
  });
});
