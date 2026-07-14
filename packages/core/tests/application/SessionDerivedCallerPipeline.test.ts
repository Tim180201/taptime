import { describe, expect, it } from 'vitest';
import { FakeNfcScanAdapter } from '../../src/infrastructure/adapters/FakeNfcScanAdapter';
import { InMemoryNfcTagRepository } from '../../src/infrastructure/repositories/InMemoryNfcTagRepository';
import { InMemoryNfcAssignmentRepository } from '../../src/infrastructure/repositories/InMemoryNfcAssignmentRepository';
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryWorkEventRepository } from '../../src/infrastructure/repositories/InMemoryWorkEventRepository';
import { InMemoryTimeEntryRepository } from '../../src/infrastructure/repositories/InMemoryTimeEntryRepository';
import { InMemoryOfflineQueue } from '../../src/infrastructure/repositories/InMemoryOfflineQueue';
import { AssignmentResolver } from '../../src/business/AssignmentResolver';
import { AssignmentValidator } from '../../src/business/AssignmentValidator';
import { WorkEventFactory } from '../../src/business/WorkEventFactory';
import { BusinessEngine } from '../../src/business/BusinessEngine';
import { NfcScanApplicationService } from '../../src/application/NfcScanApplicationService';
import { WorkEventCreationService } from '../../src/application/WorkEventCreationService';
import { SessionService, toCallerContext } from '../../src/application/SessionService';
import { DEFAULT_DEMO_ACCOUNT, FakeAuthenticationGateway } from '../../src/infrastructure/adapters/FakeAuthenticationGateway';
import { NfcAssignmentId, NfcTagId, CustomerId, WorkEventId, TimeEntryId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller } from '../../src/domain/CallerContext';
import { createTimestamp } from '../../src/domain/Timestamp';
import { createNfcPayload } from '../../src/domain/NfcPayload';
import type { NfcTag } from '../../src/domain/NfcTag';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { Customer } from '../../src/domain/Customer';

// DT-013: proves that substituting a SessionService-derived CallerContext for the existing
// hard-coded authenticatedCaller(...) fixture is behavior-preserving, not behavior-changing.
// AssignmentValidator/BusinessEngine/WorkEventCreationService are reused completely
// unmodified (Development Sprint 007 Plan, Section 11).
describe('Scan pipeline driven by a SessionService-derived CallerContext', () => {
  const organizationId = DEFAULT_DEMO_ACCOUNT.organizationId;
  const payload = 'known-tag-payload';
  const tag: NfcTag = { id: NfcTagId('tag-1'), organizationId, displayName: 'Synthetic Tag', payload: createNfcPayload(payload) };
  const target = customerAssignmentTarget(CustomerId('customer-1'));
  const assignment: NfcAssignment = {
    id: NfcAssignmentId('assignment-1'),
    organizationId,
    nfcTagId: tag.id,
    target,
    active: true,
  };
  const activeCustomer: Customer = { id: CustomerId('customer-1'), organizationId, displayName: 'Synthetic Customer', active: true };

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
    const workEventFactory = new WorkEventFactory(
      () => WorkEventId('work-event-1'),
      () => createTimestamp('2026-07-06T09:00:00.000Z'),
    );
    const businessEngine = new BusinessEngine(() => TimeEntryId('time-entry-1'));
    const workEventCreationPort = new WorkEventCreationService(
      workEventFactory,
      businessEngine,
      workEventRepository,
      timeEntryRepository,
      offlineQueue,
      undefined,
      () => createTimestamp('2026-07-06T09:00:02.000Z'),
    );

    const applicationService = new NfcScanApplicationService(
      adapter,
      resolver,
      validator,
      workEventCreationPort,
      () => createTimestamp('2026-07-06T08:00:00.000Z'),
    );

    return { adapter, applicationService, workEventRepository, timeEntryRepository };
  }

  it('reaches the same accepted+started outcome as the hard-coded authenticatedCaller() fixture', async () => {
    const sessionService = new SessionService(new FakeAuthenticationGateway());
    const authenticationResult = await sessionService.signIn({ signInCode: DEFAULT_DEMO_ACCOUNT.signInCode });
    const sessionCaller = toCallerContext(authenticationResult);

    const hardCodedCaller = authenticatedCaller(DEFAULT_DEMO_ACCOUNT.userId, DEFAULT_DEMO_ACCOUNT.organizationId);
    expect(sessionCaller).toEqual(hardCodedCaller);

    const { adapter, applicationService, workEventRepository, timeEntryRepository } = buildPipeline();
    adapter.triggerScan(payload);

    const outcome = await applicationService.submitScan(sessionCaller);

    expect(outcome).toEqual({
      stage: 'validation',
      result: {
        status: 'accepted',
        assignment,
        target: activeCustomer,
        caller: hardCodedCaller,
      },
    });
    expect(await workEventRepository.findAll()).toHaveLength(1);
    expect((await timeEntryRepository.findActiveByUser(organizationId, DEFAULT_DEMO_ACCOUNT.userId))?.status).toBe('started');
  });

  it('does not modify AssignmentValidator\'s existing employee_not_authenticated check: a rejected sign-in still produces that exact rejection', async () => {
    const sessionService = new SessionService(new FakeAuthenticationGateway());
    const authenticationResult = await sessionService.signIn({ signInCode: 'not-a-real-code' });
    expect(authenticationResult).toEqual({ status: 'rejected', reason: 'invalid_credentials' });
    const sessionCaller = toCallerContext(authenticationResult);
    expect(sessionCaller).toEqual({ status: 'unauthenticated' });

    const { adapter, applicationService } = buildPipeline();
    adapter.triggerScan(payload);

    const outcome = await applicationService.submitScan(sessionCaller);

    expect(outcome).toEqual({
      stage: 'validation',
      result: { status: 'rejected', assignment, reason: 'employee_not_authenticated' },
    });
  });
});
