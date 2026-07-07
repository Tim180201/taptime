import { describe, expect, it } from 'vitest';
import { classifyScanPipelineOutcome } from '../../src/application/classifyScanPipelineOutcome';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller } from '../../src/domain/CallerContext';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { Customer } from '../../src/domain/Customer';
import type { ScanPipelineOutcome } from '../../src/application/ScanPipelineOutcome';

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

describe('classifyScanPipelineOutcome (DT-009)', () => {
  it('classifies an unreadable capture outcome as recoverable', () => {
    const outcome: ScanPipelineOutcome = { stage: 'capture', status: 'unreadable' };

    expect(classifyScanPipelineOutcome(outcome)).toBe('recoverable');
  });

  it.each(['unknown_tag', 'inactive_assignment'] as const)(
    'classifies a %s resolution rejection as recoverable',
    (reason) => {
      const outcome: ScanPipelineOutcome = { stage: 'resolution', status: 'rejected', reason };

      expect(classifyScanPipelineOutcome(outcome)).toBe('recoverable');
    },
  );

  it.each([
    ['employee_not_authenticated', 'recoverable'],
    ['employee_lacks_organization_access', 'fatal'],
    ['missing_assignment_target', 'fatal'],
    ['assignment_target_disabled', 'fatal'],
  ] as const)('delegates a %s validation rejection to classifyAssignmentValidationResult, yielding %s', (reason, category) => {
    const outcome: ScanPipelineOutcome = {
      stage: 'validation',
      result: { status: 'rejected', assignment, reason },
    };

    expect(classifyScanPipelineOutcome(outcome)).toBe(category);
  });

  it('returns null for an accepted validation outcome (not an error)', () => {
    const outcome: ScanPipelineOutcome = {
      stage: 'validation',
      result: { status: 'accepted', assignment, target: customer, caller },
    };

    expect(classifyScanPipelineOutcome(outcome)).toBeNull();
  });
});
