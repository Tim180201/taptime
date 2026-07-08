import { describe, expect, it } from 'vitest';
import { InMemoryMembershipRepository } from '../../src/infrastructure/repositories/InMemoryMembershipRepository';
import { MembershipId, OrganizationId, UserId } from '../../src/domain/ids';
import type { Membership } from '../../src/domain/Membership';

describe('InMemoryMembershipRepository (DT-018)', () => {
  it('returns null when no Membership was ever saved for the given userId', () => {
    const repository = new InMemoryMembershipRepository();

    expect(repository.findByUserId(UserId('user-1'))).toBeNull();
  });

  it('saves a Membership and finds it again by userId (round-trip)', () => {
    const repository = new InMemoryMembershipRepository();
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };

    repository.save(membership);

    expect(repository.findByUserId(UserId('user-1'))).toEqual(membership);
  });

  it('does not find a Membership saved under a different userId', () => {
    const repository = new InMemoryMembershipRepository();
    repository.save({
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'employee',
    });

    expect(repository.findByUserId(UserId('user-2'))).toBeNull();
  });

  it('supports constructor-seeded Memberships, matching InMemoryOrganizationRepository\'s pattern', () => {
    const seeded: Membership = {
      id: MembershipId('membership-seed'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-seed'),
      role: 'administrator',
    };
    const repository = new InMemoryMembershipRepository([seeded]);

    expect(repository.findByUserId(UserId('user-seed'))).toEqual(seeded);
  });

  it('does not mutate the array passed into its constructor', () => {
    const seed: Membership[] = [
      {
        id: MembershipId('membership-seed'),
        organizationId: OrganizationId('org-1'),
        userId: UserId('user-seed'),
        role: 'employee',
      },
    ];
    const repository = new InMemoryMembershipRepository(seed);

    repository.save({
      id: MembershipId('membership-2'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-2'),
      role: 'employee',
    });

    expect(seed).toHaveLength(1);
  });
});
