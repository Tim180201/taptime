import { describe, expect, it, vi } from 'vitest';
import { NfcScanApplicationService } from '../../src/application/NfcScanApplicationService';
import { AssignmentResolver } from '../../src/business/AssignmentResolver';
import { AssignmentValidator } from '../../src/business/AssignmentValidator';
import { FakeNfcScanAdapter } from '../../src/infrastructure/adapters/FakeNfcScanAdapter';
import { InMemoryNfcTagRepository } from '../../src/infrastructure/repositories/InMemoryNfcTagRepository';
import { InMemoryNfcAssignmentRepository } from '../../src/infrastructure/repositories/InMemoryNfcAssignmentRepository';
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId } from '../../src/domain/ids';
import { createNfcPayload } from '../../src/domain/NfcPayload';
import { createTimestamp } from '../../src/domain/Timestamp';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller, UNAUTHENTICATED_CALLER } from '../../src/domain/CallerContext';
import type { WorkEventCreationPort } from '../../src/ports/WorkEventCreationPort';
import type { NfcTag } from '../../src/domain/NfcTag';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { Customer } from '../../src/domain/Customer';

const organizationId = OrganizationId('org-1');
const payload = createNfcPayload('known-tag-payload');
const tag: NfcTag = { id: NfcTagId('tag-1'), organizationId, displayName: 'Synthetic Tag', payload };
const target = customerAssignmentTarget(CustomerId('customer-1'));
const assignment: NfcAssignment = {
  id: NfcAssignmentId('assignment-1'),
  organizationId,
  nfcTagId: tag.id,
  target,
  active: true,
};
const activeCustomer: Customer = { id: CustomerId('customer-1'), organizationId, displayName: 'Synthetic Customer', active: true };

function buildService(options: {
  tags?: NfcTag[];
  assignments?: NfcAssignment[];
  customers?: Customer[];
  workEventCreationPort?: WorkEventCreationPort;
}) {
  const adapter = new FakeNfcScanAdapter();
  const resolver = new AssignmentResolver(
    new InMemoryNfcTagRepository(options.tags ?? []),
    new InMemoryNfcAssignmentRepository(options.assignments ?? []),
  );
  const validator = new AssignmentValidator(new InMemoryCustomerRepository(options.customers ?? []));
  const workEventCreationPort: WorkEventCreationPort = options.workEventCreationPort ?? {
    handleValidatedAssignment: vi.fn().mockResolvedValue(undefined),
  };
  const service = new NfcScanApplicationService(
    adapter,
    resolver,
    validator,
    workEventCreationPort,
    () => createTimestamp('2026-07-03T10:00:00.000Z'),
  );
  return { adapter, service, workEventCreationPort };
}

describe('NfcScanApplicationService (orchestration)', () => {
  it('returns an unreadable capture outcome and does not call the Business Engine boundary', async () => {
    const { adapter, service, workEventCreationPort } = buildService({});
    adapter.triggerUnreadableScan();

    const outcome = await service.submitScan(authenticatedCaller(UserId('user-1'), organizationId));

    expect(outcome).toEqual({ stage: 'capture', status: 'unreadable' });
    expect(workEventCreationPort.handleValidatedAssignment).not.toHaveBeenCalled();
  });

  it('forwards an unknown-tag resolution rejection without calling the validator outcome or the port', async () => {
    const { adapter, service, workEventCreationPort } = buildService({});
    adapter.triggerScan('known-tag-payload');

    const outcome = await service.submitScan(authenticatedCaller(UserId('user-1'), organizationId));

    expect(outcome).toEqual({ stage: 'resolution', status: 'rejected', reason: 'unknown_tag' });
    expect(workEventCreationPort.handleValidatedAssignment).not.toHaveBeenCalled();
  });

  it('forwards a validation rejection without calling the Business Engine boundary', async () => {
    const { adapter, service, workEventCreationPort } = buildService({
      tags: [tag],
      assignments: [assignment],
      customers: [],
    });
    adapter.triggerScan('known-tag-payload');

    const outcome = await service.submitScan(authenticatedCaller(UserId('user-1'), organizationId));

    expect(outcome).toEqual({
      stage: 'validation',
      result: { status: 'rejected', assignment, reason: 'missing_assignment_target' },
    });
    expect(workEventCreationPort.handleValidatedAssignment).not.toHaveBeenCalled();
  });

  it('calls resolver then validator in order, forwards the accepted result unchanged and hands it to the Business Engine boundary', async () => {
    const { adapter, service, workEventCreationPort } = buildService({
      tags: [tag],
      assignments: [assignment],
      customers: [activeCustomer],
    });
    adapter.triggerScan('known-tag-payload');
    const caller = authenticatedCaller(UserId('user-1'), organizationId);

    const outcome = await service.submitScan(caller);

    const expectedResult = { status: 'accepted', assignment, target: activeCustomer, caller };
    expect(outcome).toEqual({ stage: 'validation', result: expectedResult });
    expect(workEventCreationPort.handleValidatedAssignment).toHaveBeenCalledTimes(1);
    expect(workEventCreationPort.handleValidatedAssignment).toHaveBeenCalledWith(expectedResult);
  });

  it('does not itself decide accept/reject: an unauthenticated caller is rejected by the validator, not the service', async () => {
    const { adapter, service, workEventCreationPort } = buildService({
      tags: [tag],
      assignments: [assignment],
      customers: [activeCustomer],
    });
    adapter.triggerScan('known-tag-payload');

    const outcome = await service.submitScan(UNAUTHENTICATED_CALLER);

    expect(outcome).toEqual({
      stage: 'validation',
      result: { status: 'rejected', assignment, reason: 'employee_not_authenticated' },
    });
    expect(workEventCreationPort.handleValidatedAssignment).not.toHaveBeenCalled();
  });
});
