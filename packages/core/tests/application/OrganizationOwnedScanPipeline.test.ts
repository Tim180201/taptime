import { describe, expect, it, vi } from 'vitest';
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryNfcTagRepository } from '../../src/infrastructure/repositories/InMemoryNfcTagRepository';
import { InMemoryNfcAssignmentRepository } from '../../src/infrastructure/repositories/InMemoryNfcAssignmentRepository';
import { InMemoryWorkEventRepository } from '../../src/infrastructure/repositories/InMemoryWorkEventRepository';
import { InMemoryTimeEntryRepository } from '../../src/infrastructure/repositories/InMemoryTimeEntryRepository';
import { InMemoryOfflineQueue } from '../../src/infrastructure/repositories/InMemoryOfflineQueue';
import { FakeNfcScanAdapter } from '../../src/infrastructure/adapters/FakeNfcScanAdapter';
import { AssignmentResolver } from '../../src/business/AssignmentResolver';
import { AssignmentValidator } from '../../src/business/AssignmentValidator';
import { WorkEventFactory } from '../../src/business/WorkEventFactory';
import { BusinessEngine } from '../../src/business/BusinessEngine';
import { NfcScanApplicationService } from '../../src/application/NfcScanApplicationService';
import { WorkEventCreationService } from '../../src/application/WorkEventCreationService';
import { OrganizationId, CustomerId, NfcTagId, NfcAssignmentId, WorkEventId, TimeEntryId, UserId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller } from '../../src/domain/CallerContext';
import { createTimestamp } from '../../src/domain/Timestamp';
import { createNfcPayload } from '../../src/domain/NfcPayload';

// Keep the tenant-bound scan-chain checks; deleted administration services are not test fixtures.
describe('Organization-owned data flowing through the existing scan pipeline (DT-026)', () => {
  function buildOrganizationOwnedPipeline() {
    const organizationId = OrganizationId('org-a');
    const customerId = CustomerId('customer-a');
    const tag = {
      id: NfcTagId('tag-a'), organizationId, displayName: 'Main Entrance',
      payload: createNfcPayload('org-a-known-tag'),
    };
    const nfcAssignment = {
      id: NfcAssignmentId('assignment-a'), organizationId, nfcTagId: tag.id,
      target: customerAssignmentTarget(customerId), active: true,
    };
    const customerRepository = new InMemoryCustomerRepository([{
      id: customerId, organizationId, displayName: 'Nordwerk Logistics', active: true,
    }]);
    const nfcTagRepository = new InMemoryNfcTagRepository([tag]);
    const nfcAssignmentRepository = new InMemoryNfcAssignmentRepository([nfcAssignment]);
    const workEventRepository = new InMemoryWorkEventRepository();
    const timeEntryRepository = new InMemoryTimeEntryRepository();
    const offlineQueue = new InMemoryOfflineQueue();

    const assignmentResolver = new AssignmentResolver(nfcTagRepository, nfcAssignmentRepository);
    const assignmentValidator = new AssignmentValidator(customerRepository);

    let workEventCounter = 0;
    const workEventFactory = new WorkEventFactory(
      () => WorkEventId(`work-event-${++workEventCounter}`),
      () => createTimestamp('2026-07-09T12:00:00.000Z'),
    );
    let timeEntryCounter = 0;
    const businessEngine = new BusinessEngine(() => TimeEntryId(`time-entry-${++timeEntryCounter}`));
    const onEvent = vi.fn();
    const workEventCreationService = new WorkEventCreationService(
      workEventFactory,
      businessEngine,
      workEventRepository,
      timeEntryRepository,
      offlineQueue,
      onEvent,
      () => createTimestamp('2026-07-09T12:00:02.000Z'),
    );

    const adapter = new FakeNfcScanAdapter();
    const nfcScanApplicationService = new NfcScanApplicationService(
      adapter,
      assignmentResolver,
      assignmentValidator,
      workEventCreationService,
      () => createTimestamp('2026-07-09T10:00:00.000Z'),
    );

    return {
      organizationId,
      nfcAssignment,
      adapter,
      nfcScanApplicationService,
      workEventRepository,
      timeEntryRepository,
    };
  }

  it('creates a traceable WorkEvent and TimeEntry for the caller organization', async () => {
    const {
      organizationId,
      nfcAssignment,
      adapter,
      nfcScanApplicationService,
      workEventRepository,
      timeEntryRepository,
    } = buildOrganizationOwnedPipeline();

    const userId = UserId('user-employee-a');

    adapter.triggerScan('org-a-known-tag');
    const caller = authenticatedCaller(userId, organizationId);
    const outcome = await nfcScanApplicationService.submitScan(caller);

    expect(outcome.stage).toBe('validation');
    if (outcome.stage !== 'validation') {
      throw new Error('expected a validation-stage outcome');
    }
    expect(outcome.result.status).toBe('accepted');

    const savedWorkEvents = await workEventRepository.findAll();
    expect(savedWorkEvents).toHaveLength(1);
    const savedWorkEvent = savedWorkEvents[0];
    expect(savedWorkEvent).toBeDefined();
    if (savedWorkEvent === undefined) {
      throw new Error('expected a saved WorkEvent');
    }
    expect(savedWorkEvent.organizationId).toBe(nfcAssignment.organizationId);
    expect(savedWorkEvent.assignmentId).toBe(nfcAssignment.id);
    expect(savedWorkEvent.nfcTagId).toBe(nfcAssignment.nfcTagId);
    expect(savedWorkEvent.target).toEqual(nfcAssignment.target);

    const startedTimeEntry = await timeEntryRepository.findActiveByUser(organizationId, userId);
    expect(startedTimeEntry).not.toBeNull();
    expect(startedTimeEntry?.status).toBe('started');
  });

  it('rejects a caller from another organization without creating a WorkEvent', async () => {
    const {
      organizationId,
      nfcAssignment,
      adapter,
      nfcScanApplicationService,
      workEventRepository,
    } = buildOrganizationOwnedPipeline();

    adapter.triggerScan('org-a-known-tag');
    const caller = authenticatedCaller(UserId('user-employee-b'), OrganizationId('org-b'));
    const outcome = await nfcScanApplicationService.submitScan(caller);

    expect(outcome.stage).toBe('validation');
    if (outcome.stage !== 'validation') {
      throw new Error('expected a validation-stage outcome');
    }
    expect(outcome.result).toEqual(
      expect.objectContaining({ status: 'rejected', reason: 'employee_lacks_organization_access' }),
    );
    expect(await workEventRepository.findAll()).toHaveLength(0);
  });
});
