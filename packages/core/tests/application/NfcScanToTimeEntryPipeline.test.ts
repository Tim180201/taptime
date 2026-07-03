import { describe, expect, it, vi } from 'vitest';
import { FakeNfcScanAdapter } from '../../src/infrastructure/adapters/FakeNfcScanAdapter';
import { InMemoryNfcTagRepository } from '../../src/infrastructure/repositories/InMemoryNfcTagRepository';
import { InMemoryNfcAssignmentRepository } from '../../src/infrastructure/repositories/InMemoryNfcAssignmentRepository';
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryWorkEventRepository } from '../../src/infrastructure/repositories/InMemoryWorkEventRepository';
import { InMemoryTimeEntryRepository } from '../../src/infrastructure/repositories/InMemoryTimeEntryRepository';
import { AssignmentResolver } from '../../src/business/AssignmentResolver';
import { AssignmentValidator } from '../../src/business/AssignmentValidator';
import { WorkEventFactory } from '../../src/business/WorkEventFactory';
import { BusinessEngine } from '../../src/business/BusinessEngine';
import { NfcScanApplicationService } from '../../src/application/NfcScanApplicationService';
import { WorkEventCreationService } from '../../src/application/WorkEventCreationService';
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
    const workEventFactory = new WorkEventFactory(
      () => WorkEventId('work-event-1'),
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
      onEvent,
    );

    const applicationService = new NfcScanApplicationService(
      adapter,
      resolver,
      validator,
      workEventCreationPort,
      () => createTimestamp('2026-07-03T10:00:00.000Z'),
    );

    return { adapter, applicationService, workEventRepository, timeEntryRepository, onEvent };
  }

  it('turns an accepted scan into an observable TimeEntryStarted when no prior session exists', () => {
    const { adapter, applicationService, workEventRepository, timeEntryRepository, onEvent } = buildPipeline();
    adapter.triggerScan(payload);

    const outcome = applicationService.submitScan(caller);

    expect(outcome.stage).toBe('validation');
    expect(workEventRepository.findAll()).toHaveLength(1);
    const startedTimeEntry = timeEntryRepository.findActiveByTarget(organizationId, target);
    expect(startedTimeEntry).not.toBeNull();
    expect(startedTimeEntry?.status).toBe('started');
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'TimeEntryStarted' }));
  });

  it('does not create a second active TimeEntry for a second scan of the same target (escalation, never a guess)', () => {
    const { adapter, applicationService, timeEntryRepository } = buildPipeline();
    adapter.triggerScan(payload);
    applicationService.submitScan(caller);

    adapter.triggerScan(payload);
    applicationService.submitScan(caller);

    const activeEntries = timeEntryRepository.findAll().filter((entry) => entry.status === 'started');
    expect(activeEntries).toHaveLength(1);
  });
});
