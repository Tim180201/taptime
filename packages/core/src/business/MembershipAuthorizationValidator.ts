import type { Membership } from '../domain/Membership';
import type { OrganizationId } from '../domain/ids';
import type { MembershipAuthorizationResult } from './MembershipAuthorizationResult';

// Pure authorization over an already resolved membership and target organization.
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
