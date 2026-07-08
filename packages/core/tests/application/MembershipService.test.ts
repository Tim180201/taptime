import { describe, expect, it, vi } from 'vitest';
import { MembershipService } from '../../src/application/MembershipService';
import { InMemoryMembershipRepository } from '../../src/infrastructure/repositories/InMemoryMembershipRepository';
import { MembershipId, OrganizationId, UserId } from '../../src/domain/ids';
import type { MembershipRepository } from '../../src/ports/MembershipRepository';

describe('MembershipService (DT-018)', () => {
  it('constructs a Membership using the injected deterministic id generator, saves it, and produces MembershipGranted with the correct fields', () => {
    const repository = new InMemoryMembershipRepository();
    const service = new MembershipService(repository, () => MembershipId('membership-fixed-1'));

    const event = service.grantMembership(OrganizationId('org-1'), UserId('user-1'), 'administrator');

    expect(event).toEqual({
      type: 'MembershipGranted',
      membership: {
        id: MembershipId('membership-fixed-1'),
        organizationId: OrganizationId('org-1'),
        userId: UserId('user-1'),
        role: 'administrator',
      },
    });
    expect(repository.findByUserId(UserId('user-1'))).toEqual(event.membership);
  });

  it('calls the repository save method with exactly the constructed Membership', () => {
    const save = vi.fn();
    const repository: MembershipRepository = { findByUserId: vi.fn().mockReturnValue(null), save };
    const service = new MembershipService(repository, () => MembershipId('membership-fixed-2'));

    const event = service.grantMembership(OrganizationId('org-1'), UserId('user-2'), 'employee');

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(event.membership);
    expect(event.membership).toEqual({
      id: MembershipId('membership-fixed-2'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-2'),
      role: 'employee',
    });
  });

  it('is deterministic: the same injected id generator and inputs always produce the same Membership', () => {
    const first = new MembershipService(new InMemoryMembershipRepository(), () =>
      MembershipId('membership-fixed-3'),
    ).grantMembership(OrganizationId('org-1'), UserId('user-3'), 'administrator');
    const second = new MembershipService(new InMemoryMembershipRepository(), () =>
      MembershipId('membership-fixed-3'),
    ).grantMembership(OrganizationId('org-1'), UserId('user-3'), 'administrator');

    expect(first).toEqual(second);
  });

  it('generates a unique id by default when no generator is injected (no hidden randomness required by the caller)', () => {
    const repository = new InMemoryMembershipRepository();
    const service = new MembershipService(repository);

    const event = service.grantMembership(OrganizationId('org-1'), UserId('user-4'), 'employee');

    expect(event.membership.id.length).toBeGreaterThan(0);
    expect(event.membership.role).toBe('employee');
  });

  it('performs no authorization check: grants succeed unconditionally for any organizationId, including one with no known Organization', () => {
    const repository = new InMemoryMembershipRepository();
    const service = new MembershipService(repository, () => MembershipId('membership-fixed-5'));

    const event = service.grantMembership(OrganizationId('org-does-not-exist'), UserId('user-5'), 'administrator');

    expect(event.membership.organizationId).toBe(OrganizationId('org-does-not-exist'));
    expect(repository.findByUserId(UserId('user-5'))).not.toBeNull();
  });

  it('applies no special case for a second Membership grant (no bootstrap/first-Administrator logic)', () => {
    const repository = new InMemoryMembershipRepository();
    let counter = 0;
    const service = new MembershipService(repository, () => MembershipId(`membership-${++counter}`));

    const first = service.grantMembership(OrganizationId('org-1'), UserId('user-a'), 'administrator');
    const second = service.grantMembership(OrganizationId('org-1'), UserId('user-b'), 'administrator');

    expect(first.membership.id).not.toBe(second.membership.id);
    expect(repository.findByUserId(UserId('user-a'))).not.toBeNull();
    expect(repository.findByUserId(UserId('user-b'))).not.toBeNull();
  });
});
