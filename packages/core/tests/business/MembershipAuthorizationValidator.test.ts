import { describe, expect, it } from 'vitest';
import { MembershipAuthorizationValidator } from '../../src/business/MembershipAuthorizationValidator';
import { MembershipId, OrganizationId, UserId } from '../../src/domain/ids';
import type { Membership } from '../../src/domain/Membership';

const organizationId = OrganizationId('org-1');
const otherOrganizationId = OrganizationId('org-2');

function buildMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: MembershipId('membership-1'),
    organizationId,
    userId: UserId('user-1'),
    role: 'administrator',
    ...overrides,
  };
}

describe('MembershipAuthorizationValidator (DT-019)', () => {
  it('accepts an Administrator Membership whose organizationId matches the target Organization', () => {
    const validator = new MembershipAuthorizationValidator();
    const membership = buildMembership();

    const result = validator.authorize(membership, organizationId);

    expect(result).toEqual({ status: 'accepted', membership });
  });

  it('rejects with membership_not_found when no Membership is provided', () => {
    const validator = new MembershipAuthorizationValidator();

    const result = validator.authorize(null, organizationId);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_not_found' });
  });

  it('rejects with membership_lacks_administrator_role for an Employee Membership, matching Organization', () => {
    const validator = new MembershipAuthorizationValidator();
    const membership = buildMembership({ role: 'employee' });

    const result = validator.authorize(membership, organizationId);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_lacks_administrator_role' });
  });

  it('rejects with cross_organization_access for an Administrator Membership belonging to a different Organization', () => {
    const validator = new MembershipAuthorizationValidator();
    const membership = buildMembership({ organizationId: otherOrganizationId });

    const result = validator.authorize(membership, organizationId);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
  });

  it('is pure and deterministic: the same inputs always produce the same result', () => {
    const validator = new MembershipAuthorizationValidator();
    const membership = buildMembership();

    const first = validator.authorize(membership, organizationId);
    const second = validator.authorize(membership, organizationId);

    expect(first).toEqual(second);
  });

  it('does not resolve the first-Administrator bootstrap question: membership_not_found is rejected unconditionally, with no special-casing', () => {
    const validator = new MembershipAuthorizationValidator();

    const result = validator.authorize(null, organizationId);

    expect(result.status).toBe('rejected');
  });
});
