import type { NfcAssignment } from '../domain/NfcAssignment';
import type { CallerContext } from '../domain/CallerContext';
import type { CustomerRepository } from '../ports/CustomerRepository';
import type { AssignmentValidationResult } from './AssignmentValidationResult';

export class AssignmentValidator {
  constructor(private readonly customerRepository: CustomerRepository) {}

  validate(assignment: NfcAssignment, caller: CallerContext): AssignmentValidationResult {
    if (caller.status !== 'authenticated') {
      return { status: 'rejected', assignment, reason: 'employee_not_authenticated' };
    }

    if (caller.organizationId !== assignment.organizationId) {
      return { status: 'rejected', assignment, reason: 'employee_lacks_organization_access' };
    }

    const target = this.customerRepository.findById(assignment.target.targetId);
    if (target === null) {
      return { status: 'rejected', assignment, reason: 'missing_assignment_target' };
    }

    if (!target.active) {
      return { status: 'rejected', assignment, reason: 'assignment_target_disabled' };
    }

    return { status: 'accepted', assignment, target, caller };
  }
}
