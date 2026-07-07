import { describe, expect, it } from 'vitest';
import { classifyAssignmentValidationResult } from '../../src/business/classifyAssignmentValidationResult';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller } from '../../src/domain/CallerContext';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { Customer } from '../../src/domain/Customer';
import type { AssignmentValidationResult } from '../../src/business/AssignmentValidationResult';

const organizationId = OrganizationId('org-1');
const assignment: NfcAssignment = {
  id: NfcAssignmentId('assignment-1'),
  organizationId,
  nfcTagId: NfcTagId('tag-1'),
  target: customerAssignmentTarget(CustomerId('customer-1')),
  active: true,
};
const customer: Customer = { id: CustomerId('customer-1'), organizationId, active: true };
const caller = authenticatedCaller(UserId('user-1'), organizationId);

describe('classifyAssignmentValidationResult (DT-009)', () => {
  it('returns null for an accepted result (not an error)', () => {
    const result: AssignmentValidationResult = { status: 'accepted', assignment, target: customer, caller };

    expect(classifyAssignmentValidationResult(result)).toBeNull();
  });

  it.each([
    ['employee_not_authenticated', 'recoverable'],
    ['employee_lacks_organization_access', 'fatal'],
    ['missing_assignment_target', 'fatal'],
    ['assignment_target_disabled', 'fatal'],
  ] as const)('classifies %s as %s', (reason, category) => {
    const result: AssignmentValidationResult = { status: 'rejected', assignment, reason };

    expect(classifyAssignmentValidationResult(result)).toBe(category);
  });
});
