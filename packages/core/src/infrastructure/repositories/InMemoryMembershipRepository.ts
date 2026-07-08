import type { MembershipRepository } from '../../ports/MembershipRepository';
import type { Membership } from '../../domain/Membership';
import type { UserId } from '../../domain/ids';

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly memberships: Membership[];

  constructor(memberships: readonly Membership[] = []) {
    this.memberships = [...memberships];
  }

  findByUserId(userId: UserId): Membership | null {
    return this.memberships.find((membership) => membership.userId === userId) ?? null;
  }

  save(membership: Membership): void {
    this.memberships.push(membership);
  }
}
