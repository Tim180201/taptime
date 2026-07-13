import type { MembershipRepository } from '../ports/MembershipRepository';
import type { Membership } from '../domain/Membership';
import type { MembershipRole } from '../domain/MembershipRole';
import { MembershipId, type OrganizationId, type UserId } from '../domain/ids';
import { generateId } from '../domain/generateId';
import { membershipGranted, type MembershipGranted } from '../domain/events/MembershipGranted';

// DT-018 (TS-002 Application Services, Capability 2 / FB-002 Decision 2). Foundation only:
// constructs a Membership, calls MembershipRepository.save, produces MembershipGranted. Owns
// no business rule of any kind - no authorization check (MembershipAuthorizationValidator is
// DT-019, not built here), no bootstrap special-casing for the first Membership of an
// Organization, no verification that organizationId refers to a real Organization. Deterministic
// id generation is injectable, mirroring OrganizationManagementService's established pattern.
export class MembershipService {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly newMembershipId: () => MembershipId = () => MembershipId(generateId()),
  ) {}

  async grantMembership(
    organizationId: OrganizationId,
    userId: UserId,
    role: MembershipRole,
  ): Promise<MembershipGranted> {
    const membership: Membership = {
      id: this.newMembershipId(),
      organizationId,
      userId,
      role,
    };

    await this.membershipRepository.save(membership);

    return membershipGranted(membership);
  }
}
