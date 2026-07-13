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
import { authenticatedCaller, type CallerContext } from '../../src/domain/CallerContext';
import { createTimestamp, type Timestamp } from '../../src/domain/Timestamp';
import { createNfcPayload } from '../../src/domain/NfcPayload';
import type { NfcTag } from '../../src/domain/NfcTag';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { Customer } from '../../src/domain/Customer';
import type { StartedTimeEntry } from '../../src/domain/TimeEntry';

describe('NFC scan to TimeEntry lifecycle pipeline (F-01 end-to-end)', () => {
  const organizationId = OrganizationId('org-1');
  const userId = UserId('user-1');
  const payload = 'known-tag-payload';
  const tag: NfcTag = { id: NfcTagId('tag-1'), organizationId, payload: createNfcPayload(payload) };
  const target = customerAssignmentTarget(CustomerId('customer-1'));
  const otherTarget = customerAssignmentTarget(CustomerId('customer-2'));
  const assignment: NfcAssignment = {
    id: NfcAssignmentId('assignment-1'),
    organizationId,
    nfcTagId: tag.id,
    target,
    active: true,
  };
  const activeCustomer: Customer = { id: CustomerId('customer-1'), organizationId, active: true };
  const caller = authenticatedCaller(userId, organizationId);

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
    let currentOccurredAt = createTimestamp('2026-07-13T08:00:00.000Z');
    let workEventCounter = 0;
    let timeEntryCounter = 0;
    const workEventFactory = new WorkEventFactory(
      () => WorkEventId(`work-event-${++workEventCounter}`),
      () => currentOccurredAt,
    );
    const businessEngine = new BusinessEngine(() => TimeEntryId(`time-entry-${++timeEntryCounter}`));
    const onEvent = vi.fn();
    const workEventCreationPort = new WorkEventCreationService(
      workEventFactory,
      businessEngine,
      workEventRepository,
      timeEntryRepository,
      offlineQueue,
      onEvent,
      () => currentOccurredAt,
    );
    const applicationService = new NfcScanApplicationService(
      adapter,
      resolver,
      validator,
      workEventCreationPort,
      () => currentOccurredAt,
    );
    const synchronizationGateway = new FakeSynchronizationGateway();
    const synchronizationService = new SynchronizationService(offlineQueue, synchronizationGateway, onEvent);

    async function scanAt(occurredAt: string, scanCaller: CallerContext = caller): Promise<void> {
      currentOccurredAt = createTimestamp(occurredAt);
      adapter.triggerScan(payload);
      await applicationService.submitScan(scanCaller);
    }

    return {
      scanAt,
      workEventRepository,
      timeEntryRepository,
      offlineQueue,
      synchronizationGateway,
      synchronizationService,
      onEvent,
    };
  }

  async function decisionStatuses(offlineQueue: InMemoryOfflineQueue): Promise<Array<string | undefined>> {
    return (await offlineQueue.findPending()).map((record) => record.decision?.status);
  }

  it('starts on the first scan, queues the decision and remains synchronizable', async () => {
    const pipeline = buildPipeline();

    await pipeline.scanAt('2026-07-13T08:00:00.000Z');

    expect(await pipeline.timeEntryRepository.findActiveByUser(organizationId, userId)).toEqual(
      expect.objectContaining({ status: 'started', startedAt: '2026-07-13T08:00:00.000Z' }),
    );
    expect(await decisionStatuses(pipeline.offlineQueue)).toEqual(['time_entry_started']);
    pipeline.synchronizationGateway.configureSuccess();
    await pipeline.synchronizationService.synchronizePending();
    expect(await pipeline.offlineQueue.findPending()).toEqual([]);
  });

  it('ignores a second scan under five seconds without changing TimeEntry state', async () => {
    const pipeline = buildPipeline();
    await pipeline.scanAt('2026-07-13T08:00:00.000Z');
    const stateAfterStart = await pipeline.timeEntryRepository.findAll();

    await pipeline.scanAt('2026-07-13T08:00:04.999Z');

    expect(await pipeline.timeEntryRepository.findAll()).toEqual(stateAfterStart);
    expect(await decisionStatuses(pipeline.offlineQueue)).toEqual(['time_entry_started', 'duplicate_scan_ignored']);
    expect(pipeline.onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DuplicateScanIgnored',
        workEvent: expect.objectContaining({ id: 'work-event-2' }),
        previousWorkEvent: expect.objectContaining({ id: 'work-event-1' }),
      }),
    );
  });

  it('stops at exactly five seconds without creating a second TimeEntry', async () => {
    const pipeline = buildPipeline();
    await pipeline.scanAt('2026-07-13T08:00:00.000Z');

    await pipeline.scanAt('2026-07-13T08:00:05.000Z');

    expect(await pipeline.timeEntryRepository.findAll()).toEqual([
      expect.objectContaining({
        id: 'time-entry-1',
        status: 'stopped',
        workEventId: 'work-event-1',
        stoppedByWorkEventId: 'work-event-2',
        stoppedAt: '2026-07-13T08:00:05.000Z',
      }),
    ]);
    expect(await decisionStatuses(pipeline.offlineQueue)).toEqual(['time_entry_started', 'time_entry_stopped']);
  });

  it('stops on a later scan for the same target', async () => {
    const pipeline = buildPipeline();
    await pipeline.scanAt('2026-07-13T08:00:00.000Z');

    await pipeline.scanAt('2026-07-13T12:00:00.000Z');

    expect((await pipeline.timeEntryRepository.findAll())[0]?.status).toBe('stopped');
  });

  it('ignores a scan directly after stop and leaves the stopped state unchanged', async () => {
    const pipeline = buildPipeline();
    await pipeline.scanAt('2026-07-13T08:00:00.000Z');
    await pipeline.scanAt('2026-07-13T08:00:05.000Z');
    const stateAfterStop = await pipeline.timeEntryRepository.findAll();

    await pipeline.scanAt('2026-07-13T08:00:09.999Z');

    expect(await pipeline.timeEntryRepository.findAll()).toEqual(stateAfterStop);
    expect(await decisionStatuses(pipeline.offlineQueue)).toEqual([
      'time_entry_started',
      'time_entry_stopped',
      'duplicate_scan_ignored',
    ]);
  });

  it('supports start, stop and restart once five seconds have elapsed after stop', async () => {
    const pipeline = buildPipeline();
    await pipeline.scanAt('2026-07-13T08:00:00.000Z');
    await pipeline.scanAt('2026-07-13T08:00:05.000Z');

    await pipeline.scanAt('2026-07-13T08:00:10.000Z');

    expect(await pipeline.timeEntryRepository.findAll()).toHaveLength(2);
    expect((await pipeline.timeEntryRepository.findAll())[0]?.status).toBe('stopped');
    expect((await pipeline.timeEntryRepository.findAll())[1]).toEqual(
      expect.objectContaining({ id: 'time-entry-2', status: 'started', workEventId: 'work-event-3' }),
    );
    expect(await decisionStatuses(pipeline.offlineQueue)).toEqual([
      'time_entry_started',
      'time_entry_stopped',
      'time_entry_started',
    ]);
  });

  it('keeps different users on the same AssignmentTarget independent', async () => {
    const pipeline = buildPipeline();
    const otherUserId = UserId('user-2');
    await pipeline.scanAt('2026-07-13T08:00:00.000Z');

    await pipeline.scanAt('2026-07-13T08:00:01.000Z', authenticatedCaller(otherUserId, organizationId));

    expect((await pipeline.timeEntryRepository.findActiveByUser(organizationId, userId))?.status).toBe('started');
    expect((await pipeline.timeEntryRepository.findActiveByUser(organizationId, otherUserId))?.status).toBe('started');
    expect(await pipeline.timeEntryRepository.findAll()).toHaveLength(2);
    expect(await decisionStatuses(pipeline.offlineQueue)).toEqual(['time_entry_started', 'time_entry_started']);
  });

  it('rejects an active TimeEntry for another target without changing state', async () => {
    const pipeline = buildPipeline();
    const activeTimeEntry: StartedTimeEntry = {
      id: TimeEntryId('time-entry-existing'),
      workEventId: WorkEventId('work-event-other-target'),
      organizationId,
      userId,
      target: otherTarget,
      status: 'started',
      startedAt: createTimestamp('2026-07-13T07:00:00.000Z'),
    };
    await pipeline.timeEntryRepository.save(activeTimeEntry);

    await pipeline.scanAt('2026-07-13T08:00:00.000Z');

    expect(await pipeline.timeEntryRepository.findAll()).toEqual([activeTimeEntry]);
    expect(await decisionStatuses(pipeline.offlineQueue)).toEqual(['active_entry_for_other_target_rejected']);
  });

  it('escalates a backward WorkEvent and preserves the active TimeEntry', async () => {
    const pipeline = buildPipeline();
    await pipeline.scanAt('2026-07-13T08:00:05.000Z');
    const stateAfterStart = await pipeline.timeEntryRepository.findAll();

    await pipeline.scanAt('2026-07-13T08:00:04.999Z');

    expect(await pipeline.timeEntryRepository.findAll()).toEqual(stateAfterStart);
    expect((await pipeline.offlineQueue.findPending())[1]?.decision).toEqual(
      expect.objectContaining({
        status: 'escalation_required',
        reason: 'work_event_precedes_active_time_entry',
      }),
    );
  });
});
