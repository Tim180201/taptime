import { describe, expect, it, vi } from 'vitest';
import { InMemoryOrganizationRepository } from '../../src/infrastructure/repositories/InMemoryOrganizationRepository';
import { InMemoryMembershipRepository } from '../../src/infrastructure/repositories/InMemoryMembershipRepository';
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryNfcTagRepository } from '../../src/infrastructure/repositories/InMemoryNfcTagRepository';
import { InMemoryNfcAssignmentRepository } from '../../src/infrastructure/repositories/InMemoryNfcAssignmentRepository';
import { InMemoryWorkEventRepository } from '../../src/infrastructure/repositories/InMemoryWorkEventRepository';
import { InMemoryTimeEntryRepository } from '../../src/infrastructure/repositories/InMemoryTimeEntryRepository';
import { InMemoryOfflineQueue } from '../../src/infrastructure/repositories/InMemoryOfflineQueue';
import { FakeNfcScanAdapter } from '../../src/infrastructure/adapters/FakeNfcScanAdapter';
import { OrganizationManagementService } from '../../src/application/OrganizationManagementService';
import { MembershipService } from '../../src/application/MembershipService';
import { OrganizationAdministrationService } from '../../src/application/OrganizationAdministrationService';
import { MembershipAuthorizationValidator } from '../../src/business/MembershipAuthorizationValidator';
import { AssignmentResolver } from '../../src/business/AssignmentResolver';
import { AssignmentValidator } from '../../src/business/AssignmentValidator';
import { WorkEventFactory } from '../../src/business/WorkEventFactory';
import { BusinessEngine } from '../../src/business/BusinessEngine';
import { NfcScanApplicationService } from '../../src/application/NfcScanApplicationService';
import { WorkEventCreationService } from '../../src/application/WorkEventCreationService';
import { OrganizationId, MembershipId, CustomerId, NfcTagId, NfcAssignmentId, WorkEventId, TimeEntryId, UserId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller } from '../../src/domain/CallerContext';
import { createTimestamp } from '../../src/domain/Timestamp';
import { createNfcPayload } from '../../src/domain/NfcPayload';

// DT-026. Proves TS-002's own "Architecture Principles Preserved" claim with a real,
// repository-verifiable test: Organization-owned data created through
// OrganizationAdministrationService's three methods (DT-023/DT-024/DT-025) is consumed by the
// existing, unmodified FB-001 scan pipeline (AssignmentResolver -> AssignmentValidator ->
// WorkEventCreationService) exactly as it already consumes hard-coded demo fixtures
// (NfcScanToTimeEntryPipeline.test.ts). Adds no production code - tests/verification only.
describe('Organization-owned data flowing through the existing scan pipeline (DT-026)', () => {
  function buildOrganizationOwnedPipeline() {
    const organizationRepository = new InMemoryOrganizationRepository();
    const membershipRepository = new InMemoryMembershipRepository();
    const customerRepository = new InMemoryCustomerRepository();
    const nfcTagRepository = new InMemoryNfcTagRepository();
    const nfcAssignmentRepository = new InMemoryNfcAssignmentRepository();
    const workEventRepository = new InMemoryWorkEventRepository();
    const timeEntryRepository = new InMemoryTimeEntryRepository();
    const offlineQueue = new InMemoryOfflineQueue();

    let organizationCounter = 0;
    const organizationManagementService = new OrganizationManagementService(
      organizationRepository,
      () => OrganizationId(`org-${++organizationCounter}`),
    );

    let membershipCounter = 0;
    const membershipService = new MembershipService(
      membershipRepository,
      () => MembershipId(`membership-${++membershipCounter}`),
    );

    const membershipAuthorizationValidator = new MembershipAuthorizationValidator();

    let customerCounter = 0;
    let nfcTagCounter = 0;
    let nfcAssignmentCounter = 0;
    const organizationAdministrationService = new OrganizationAdministrationService(
      membershipAuthorizationValidator,
      customerRepository,
      nfcTagRepository,
      nfcAssignmentRepository,
      () => CustomerId(`customer-${++customerCounter}`),
      () => NfcTagId(`tag-${++nfcTagCounter}`),
      () => NfcAssignmentId(`assignment-${++nfcAssignmentCounter}`),
    );

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
      organizationManagementService,
      membershipService,
      organizationAdministrationService,
      adapter,
      nfcScanApplicationService,
      workEventRepository,
      timeEntryRepository,
    };
  }

  it('accepted path: an Employee Membership scanning Organization-owned data created via OrganizationAdministrationService produces a WorkEvent and starts a TimeEntry, matching the existing fixture-based pipeline outcome shape', async () => {
    const {
      organizationManagementService,
      membershipService,
      organizationAdministrationService,
      adapter,
      nfcScanApplicationService,
      workEventRepository,
      timeEntryRepository,
    } = buildOrganizationOwnedPipeline();

    const organizationA = (await organizationManagementService.createOrganization('Org A')).organization;
    const adminMembership = (await membershipService.grantMembership(organizationA.id, UserId('user-admin-a'), 'administrator'))
      .membership;
    const employeeMembership = (await membershipService.grantMembership(organizationA.id, UserId('user-employee-a'), 'employee'))
      .membership;

    const createCustomerResult = await organizationAdministrationService.createCustomer(
      adminMembership,
      organizationA.id,
      'Nordwerk Logistics',
    );
    if (createCustomerResult.status !== 'accepted') {
      throw new Error('expected accepted CreateCustomerResult');
    }
    const customer = createCustomerResult.customer;

    const registerNfcTagResult = await organizationAdministrationService.registerNfcTag(
      adminMembership,
      organizationA.id,
      createNfcPayload('org-a-known-tag'),
      'Main Entrance',
    );
    if (registerNfcTagResult.status !== 'accepted') {
      throw new Error('expected accepted RegisterNfcTagResult');
    }
    const nfcTag = registerNfcTagResult.nfcTag;

    const target = customerAssignmentTarget(customer.id);
    const assignNfcTagResult = await organizationAdministrationService.assignNfcTag(
      adminMembership,
      organizationA.id,
      nfcTag,
      target,
    );
    if (assignNfcTagResult.status !== 'accepted') {
      throw new Error('expected accepted AssignNfcTagResult');
    }
    const nfcAssignment = assignNfcTagResult.nfcAssignment;

    adapter.triggerScan('org-a-known-tag');
    const caller = authenticatedCaller(employeeMembership.userId, organizationA.id);
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

    const startedTimeEntry = await timeEntryRepository.findActiveByUser(organizationA.id, employeeMembership.userId);
    expect(startedTimeEntry).not.toBeNull();
    expect(startedTimeEntry?.status).toBe('started');
  });

  it('rejected: an Employee Membership from a different Organization scanning Organization-A-owned data returns employee_lacks_organization_access and creates no WorkEvent', async () => {
    const {
      organizationManagementService,
      membershipService,
      organizationAdministrationService,
      adapter,
      nfcScanApplicationService,
      workEventRepository,
    } = buildOrganizationOwnedPipeline();

    const organizationA = (await organizationManagementService.createOrganization('Org A')).organization;
    const adminMembership = (await membershipService.grantMembership(organizationA.id, UserId('user-admin-a-2'), 'administrator'))
      .membership;

    const createCustomerResult = await organizationAdministrationService.createCustomer(
      adminMembership,
      organizationA.id,
      'Nordwerk Logistics',
    );
    if (createCustomerResult.status !== 'accepted') {
      throw new Error('expected accepted CreateCustomerResult');
    }
    const customer = createCustomerResult.customer;

    const registerNfcTagResult = await organizationAdministrationService.registerNfcTag(
      adminMembership,
      organizationA.id,
      createNfcPayload('org-a-known-tag'),
      'Main Entrance',
    );
    if (registerNfcTagResult.status !== 'accepted') {
      throw new Error('expected accepted RegisterNfcTagResult');
    }
    const nfcTag = registerNfcTagResult.nfcTag;

    const target = customerAssignmentTarget(customer.id);
    const assignNfcTagResult = await organizationAdministrationService.assignNfcTag(
      adminMembership,
      organizationA.id,
      nfcTag,
      target,
    );
    if (assignNfcTagResult.status !== 'accepted') {
      throw new Error('expected accepted AssignNfcTagResult');
    }

    const organizationB = (await organizationManagementService.createOrganization('Org B')).organization;
    const employeeBMembership = (await membershipService.grantMembership(organizationB.id, UserId('user-employee-b'), 'employee'))
      .membership;

    adapter.triggerScan('org-a-known-tag');
    const caller = authenticatedCaller(employeeBMembership.userId, organizationB.id);
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
