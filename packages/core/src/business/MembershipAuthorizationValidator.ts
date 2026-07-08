import type { Membership } from '../domain/Membership';
import type { OrganizationId } from '../domain/ids';
import type { MembershipAuthorizationResult } from './MembershipAuthorizationResult';

// DT-019 (TS-002 New Business-Area Component, FB-002 Decision 6). Pure, deterministic,
// side-effect-free - structurally identical in shape to AssignmentValidator (a class with one
// evaluation method), but takes no repository dependency: its inputs (Membership, target
// OrganizationId) are passed in already resolved by its future caller, unlike
// AssignmentValidator, which must resolve a Customer itself. Not wired into MembershipService
// or any Application Service by this task - it has no caller yet (DT-023-DT-025).
export class MembershipAuthorizationValidator {
  authorize(membership: Membership | null, organizationId: OrganizationId): MembershipAuthorizationResult {
    if (membership === null) {
      return { status: 'rejected', reason: 'membership_not_found' };
    }

    if (membership.role !== 'administrator') {
      return { status: 'rejected', reason: 'membership_lacks_administrator_role' };
    }

    if (membership.organizationId !== organizationId) {
      return { status: 'rejected', reason: 'cross_organization_access' };
    }

    return { status: 'accepted', membership };
  }
}
