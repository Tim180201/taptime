import { describe, expect, it } from 'vitest';
import { AssignmentValidator } from '../../src/business/AssignmentValidator';
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller, UNAUTHENTICATED_CALLER } from '../../src/domain/CallerContext';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { Customer } from '../../src/domain/Customer';

const organizationId = OrganizationId('org-1');
const otherOrganizationId = OrganizationId('org-2');
const customerId = CustomerId('customer-1');
const target = customerAssignmentTarget(customerId);

const assignment: NfcAssignment = {
  id: NfcAssignmentId('assignment-1'),
  organizationId,
  nfcTagId: NfcTagId('tag-1'),
  target,
  active: true,
};

const activeCustomer: Customer = { id: customerId, organizationId, active: true };
const disabledCustomer: Customer = { id: customerId, organizationId, active: false };

describe('AssignmentValidator (DT-003)', () => {
  it('accepts a valid assignment for an authenticated, in-organization employee with an active target', async () => {
    const validator = new AssignmentValidator(new InMemoryCustomerRepository([activeCustomer]));
    const caller = authenticatedCaller(UserId('user-1'), organizationId);

    const result = await validator.validate(assignment, caller);

    expect(result).toEqual({ status: 'accepted', assignment, target: activeCustomer, caller });
  });

  it('rejects when the employee is not authenticated', async () => {
    const validator = new AssignmentValidator(new InMemoryCustomerRepository([activeCustomer]));

    const result = await validator.validate(assignment, UNAUTHENTICATED_CALLER);

    expect(result).toEqual({ status: 'rejected', assignment, reason: 'employee_not_authenticated' });
  });

  it('rejects when the employee lacks organization access', async () => {
    const validator = new AssignmentValidator(new InMemoryCustomerRepository([activeCustomer]));
    const caller = authenticatedCaller(UserId('user-1'), otherOrganizationId);

    const result = await validator.validate(assignment, caller);

    expect(result).toEqual({ status: 'rejected', assignment, reason: 'employee_lacks_organization_access' });
  });

  it('rejects when the assignment target is missing', async () => {
    const validator = new AssignmentValidator(new InMemoryCustomerRepository([]));
    const caller = authenticatedCaller(UserId('user-1'), organizationId);

    const result = await validator.validate(assignment, caller);

    expect(result).toEqual({ status: 'rejected', assignment, reason: 'missing_assignment_target' });
  });

  it('rejects when the customer target is disabled', async () => {
    const validator = new AssignmentValidator(new InMemoryCustomerRepository([disabledCustomer]));
    const caller = authenticatedCaller(UserId('user-1'), organizationId);

    const result = await validator.validate(assignment, caller);

    expect(result).toEqual({ status: 'rejected', assignment, reason: 'assignment_target_disabled' });
  });
});
