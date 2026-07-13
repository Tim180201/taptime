import { describe, expect, it } from 'vitest';
import { WorkEventFactory } from '../../src/business/WorkEventFactory';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller } from '../../src/domain/CallerContext';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { AcceptedAssignmentValidationResult } from '../../src/business/AssignmentValidationResult';
import type { Customer } from '../../src/domain/Customer';

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

describe('WorkEventFactory (DT-004)', () => {
  it('creates a WorkEvent with full traceability from an accepted assignment validation result', () => {
    const factory = new WorkEventFactory(
      () => WorkEventId('work-event-1'),
      () => createTimestamp('2026-07-03T12:00:00.000Z'),
    );

    const workEvent = factory.createFromAcceptedAssignment(acceptedResult);

    expect(workEvent).toEqual({
      id: 'work-event-1',
      organizationId,
      assignmentId: assignment.id,
      nfcTagId: assignment.nfcTagId,
      target,
      triggeredBy: caller.status === 'authenticated' ? caller.userId : undefined,
      occurredAt: '2026-07-03T12:00:00.000Z',
    });
  });

  it('produces deterministic output for the same input', () => {
    const factory = new WorkEventFactory(
      () => WorkEventId('work-event-1'),
      () => createTimestamp('2026-07-03T12:00:00.000Z'),
    );

    const first = factory.createFromAcceptedAssignment(acceptedResult);
    const second = factory.createFromAcceptedAssignment(acceptedResult);

    expect(first).toEqual(second);
  });

  it('generates a unique id and current timestamp by default', () => {
    const factory = new WorkEventFactory();

    const workEvent = factory.createFromAcceptedAssignment(acceptedResult);

    expect(workEvent.id.length).toBeGreaterThan(0);
    expect(() => createTimestamp(workEvent.occurredAt)).not.toThrow();
  });
});
